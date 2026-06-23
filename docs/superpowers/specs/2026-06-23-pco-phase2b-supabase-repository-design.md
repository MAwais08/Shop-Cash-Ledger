# PCO Phase 2B — SupabaseRepository (cloud persistence) — Design Spec

**Date:** 2026-06-23
**Status:** Approved (design); pending spec review
**Author:** Brainstormed with shop owner (Awais)
**Builds on:** `2026-06-22-pco-shop-management-design.md` (§7 Technical Approach, §6 Data Model)

---

## 1. Purpose

Phase 1 and Phase 2A run entirely on `localStorage`. Phase 2B introduces the
**Supabase (managed Postgres) backend** behind the existing `Repository` seam so
the app's data lives in the cloud, with **no changes to the domain or UI layers**.

This is the single, focused step of swapping the persistence implementation. It is
deliberately the *minimum correct unit*: it does not attempt realtime sync, a
relational schema, or offline resilience — those are explicitly deferred (§8).

## 2. Scope

**In scope**
- A new `SupabaseRepository` class implementing the existing
  `Repository` interface (`load(): Promise<AppData>`, `save(data): Promise<void>`).
- A single-row JSONB table (`app_state`) in Postgres that holds the entire `AppData`.
- The one-time SQL (table + RLS policy), tracked in the repo as `supabase/schema.sql`.
- Wiring: construct a real Supabase client from environment variables in `main.tsx`
  and inject it into `SupabaseRepository` — the single production swap point.
- `@supabase/supabase-js` dependency, `.env.example`, and `ImportMetaEnv` type decls.
- Full unit-test coverage of `SupabaseRepository` against an injected fake client.

**Not in scope (see §8 for rationale)**
- Relational decomposition of `AppData` into per-entity tables (spec §6).
- Realtime PC ↔ phone sync.
- Offline / write-queue / fallback caching.
- Migrating existing `localStorage` data into the cloud.

## 3. Key decisions (locked during brainstorming)

| Decision | Choice | Why |
| --- | --- | --- |
| **Storage shape** | Single JSONB blob row | Mirrors `LocalStorageRepository`; honors "no domain/UI changes"; keeps the `Repository` interface (`save` = whole blob) exactly as-is; cannot drift the golden invariant because the blob is still computed by the same pure domain functions. |
| **Network behavior** | Pure cloud, fail loudly | The literal task ("swap it in at `main.tsx`"). On network/DB error, `load()`/`save()` reject and the existing UI error paths surface it. Smallest correct unit. |
| **Auth / RLS** | Anon key + permissive RLS | Matches "single shared login"; no auth flow in the repo; PIN stays a client-side gate. Tradeoff acknowledged in §7. |

## 4. Architecture

Strict one-way dependency flow is preserved: **domain ← data ← store ← UI**.
`SupabaseRepository` lives in `src/data/`, exactly alongside `LocalStorageRepository`
and `InMemoryRepository`, and depends only on `types.ts`, `seed.ts`, `normalize.ts`,
and the injected Supabase client.

```
main.tsx ── injects ──▶ SupabaseRepository ── uses ──▶ SupabaseClient (@supabase/supabase-js)
                              │
                              ├── seedData()        (seed-on-empty, first run)
                              └── normalizeAppData() (back-compat on load)
```

The store, domain functions, and all pages/components are untouched: the store still
calls `repo.load()` / `repo.save(next)` against the `Repository` interface and neither
knows nor cares which implementation is wired in.

## 5. Data store — the `app_state` table

A single-row table holding the whole `AppData` blob:

```sql
create table app_state (
  id         int primary key default 1,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_state_singleton check (id = 1)
);

alter table app_state enable row level security;

create policy app_state_rw on app_state
  for all
  using (true)
  with check (true);   -- anon read/write; the PIN gate stays client-side
```

- `id` is always `1`; the app reads/writes that single row by primary key.
- `data` is the entire `AppData` (`settings`, `wallets`, `drawer`, `transactions`,
  `cashMovements`), the same JSON shape `LocalStorageRepository` persists.
- `updated_at` is informational (default `now()`); the app does not depend on it.
- The `check (id = 1)` constraint documents and enforces the singleton intent.

This SQL is committed as `supabase/schema.sql`. It is applied once by hand in the
Supabase SQL editor — there is no Supabase CLI / migration tooling in this project yet.

## 6. `SupabaseRepository` behavior

Implements `Repository`. Constructor injects the client so it is testable offline:

```ts
class SupabaseRepository implements Repository {
  constructor(private client: SupabaseClient) {}
  load(): Promise<AppData>
  save(data: AppData): Promise<void>
}
```

**`load()`** — semantics mirror `LocalStorageRepository.load()`:
1. `client.from('app_state').select('data').eq('id', 1).maybeSingle()`.
2. If the call returns an `error` → **throw it** (fail loudly).
3. If a row is returned → return `normalizeAppData(row.data)`
   (fills arrays missing from older persisted shapes — same back-compat as today).
4. If no row exists yet (`data === null`) → `seedData()`, upsert it as `id: 1`,
   and return the seeded data (seed-on-empty, like localStorage's first run).

**`save(data)`**:
1. `client.from('app_state').upsert({ id: 1, data })`.
2. If the call returns an `error` → **throw it** (fail loudly).

No corrupt-JSON backup path is needed (unlike `LocalStorageRepository`): `jsonb` is
already structured, so there is no raw string that can fail `JSON.parse`. Shape drift
from older data is handled by `normalizeAppData` on load.

The golden invariant is upheld for free: `SupabaseRepository` never computes money or
notes — it persists and returns the blob verbatim. All cash/wallet math remains in the
pure domain functions, which are unchanged.

## 7. Security tradeoff (acknowledged)

The anon key ships in the client JS bundle, and the RLS policy is permissive
(`using (true) with check (true)`), so the `app_state` row is effectively world-readable
and world-writable by anyone who extracts the key. For a single small shop's internal
ledger this is an acceptable, conventional Supabase posture, and the client-side PIN
still gates the UI. It can be hardened later (e.g. Supabase Auth with a shared account,
or an edge function gateway) without touching the domain or UI — only the repository and
`main.tsx` wiring would change. This is called out so the choice is explicit, not implicit.

## 8. Why the deferred items are deferred

- **Relational schema (spec §6):** the current `Repository.save(data)` contract hands
  the *whole* blob on every write. A relational backend would have to diff or
  wipe-and-reinsert every table on each save — significant complexity and a real risk to
  the golden invariant — and could not be done cleanly "with no domain changes." It
  belongs in its own phase with an evolved interface and atomic RPC functions.
- **Realtime sync:** live PC ↔ phone updates require the store/UI to subscribe to remote
  changes and re-render — a UI change, explicitly out of scope here.
- **Offline / fallback caching:** a write-queue + conflict-resolution layer is a
  deliberate, separately-reviewable feature, not part of a clean persistence swap.
- **localStorage → cloud migration:** existing data is dev-only and low value; the cloud
  starts from a fresh `seedData()`. A one-time importer can be added later if real data
  accumulates before cutover.

## 9. Testing strategy (TDD)

`SupabaseRepository` is unit-tested with **no network**, by injecting a small
hand-written **fake Supabase client** — a `fakeSupabase()` test helper that implements
exactly the fluent subset the repository uses
(`.from(table).select(col).eq(col, val).maybeSingle()` and `.from(table).upsert(payload)`),
backed by an in-memory row, and cast to `SupabaseClient` in test code. This is the same
"inject a fake dependency" approach as `InMemoryRepository(seedData())`, and it exercises
the real column/filter names rather than mocking them away.

Test cases (each written failing-first):
1. **Seed on empty** — no row present → `load()` returns seeded data (shop name
   `My PCO Shop`, three wallets, PIN `1234`) and a row is now persisted.
2. **Round-trip** — `save(modified)` then `load()` returns the modified data.
3. **Normalize on load** — a row whose `data` lacks `transactions` / `cashMovements`
   loads with those defaulted to `[]`.
4. **Load error throws** — fake client returns an `error` on select → `load()` rejects.
5. **Save error throws** — fake client returns an `error` on upsert → `save()` rejects.

`main.tsx` wiring is verified by `npm run build` (type-check gate) and manual smoke;
it contains no branching logic to unit-test.

## 10. Wiring & configuration

- **Dependency:** add `@supabase/supabase-js`.
- **Environment:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, read in `main.tsx`
  via `import.meta.env`. Add an `ImportMetaEnv` interface (in `src/vite-env.d.ts`) so
  `tsc -b` type-checks the access.
- **`.env.example`:** documents the two variables with placeholder values. The real
  `.env` is git-ignored.
- **`main.tsx`:** the single swap point —
  `init(new SupabaseRepository(createClient(url, anonKey)))` replacing
  `init(new LocalStorageRepository())`.

## 11. Success criteria

- `SupabaseRepository` implements `Repository` with no change to the interface,
  the domain layer, the store, or any page/component.
- All `SupabaseRepository` unit tests pass offline (injected fake client).
- `npm run build`, `npm run lint`, and `npm test` are all green.
- With valid env + the `app_state` table applied, the running app loads (seeding on
  first run) and persists transactions to Postgres, surviving a hard reload.
- A network/DB failure surfaces as a rejected `load()`/`save()` (fail loudly), not a
  silent no-op.
