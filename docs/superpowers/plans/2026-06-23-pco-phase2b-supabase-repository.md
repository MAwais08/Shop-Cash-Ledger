# Phase 2B — SupabaseRepository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `SupabaseRepository` that persists the whole `AppData` blob to a single Postgres JSONB row, behind the existing `Repository` interface, and swap it in at `main.tsx` — with no domain or UI changes.

**Architecture:** A new `src/data/supabaseRepository.ts` implements `Repository` (`load`/`save`) against an injected `SupabaseClient`. It reads/writes one singleton row (`app_state`, `id = 1`, column `data jsonb`), reusing `seedData()` (seed-on-empty) and `normalizeAppData()` (back-compat) exactly like `LocalStorageRepository`. The client is injected via the constructor so tests run offline against a hand-written fake. `main.tsx` builds the real client from env vars and injects the repository — the single production swap point.

**Tech Stack:** React 19 + TypeScript + Vite, Zustand store (untouched), Vitest + jsdom, `@supabase/supabase-js` v2, Supabase (managed Postgres).

**Spec:** `docs/superpowers/specs/2026-06-23-pco-phase2b-supabase-repository-design.md`

## Global Constraints

Every task's requirements implicitly include all of these (copied from `CLAUDE.md` / `tsconfig.app.json`):

- **No domain or UI changes.** Only add files under `src/data/` (plus root config) and modify `src/main.tsx`. Do not touch `src/domain/`, `src/store/`, `src/pages/`, `src/components/`, or the `Repository` interface in `src/data/repository.ts`.
- **`verbatimModuleSyntax` is ON.** Every type-only import MUST be `import type { … }` (or inline `import { type X, y }`). Unused imports/vars/params fail the build (`noUnusedLocals` / `noUnusedParameters`).
- **`erasableSyntaxOnly` is ON.** No TypeScript parameter properties (`constructor(private x: T)`) and no `enum`s. Declare the field separately and assign in the constructor body — exactly as `InMemoryRepository` does (`private data: AppData` + `this.data = …`).
- **`Repository` contract is whole-blob:** `load(): Promise<AppData>`, `save(data: AppData): Promise<void>`. `SupabaseRepository` persists and returns `AppData` verbatim; it performs no money/notes math (the golden invariant stays in the pure domain layer).
- **`npm run build` (`tsc -b && vite build`) is the real type-check gate.** Vitest transpiles without `tsc`, so a change can pass tests and still break the build. Run `npm run build` before declaring a task done.
- **Platform:** Windows. Default shell is PowerShell; a Bash tool is available for POSIX scripts. The commands below are shell-agnostic (`npm …`, `npx …`, `git …`).

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `src/data/supabaseRepository.ts` | **Create.** `SupabaseRepository implements Repository` — load/seed/normalize/save against an injected client. | 1 |
| `src/data/supabaseRepository.test.ts` | **Create.** Offline unit tests + `fakeSupabase()` helper. | 1 |
| `package.json` / `package-lock.json` | **Modify.** Add `@supabase/supabase-js` dependency. | 1 |
| `supabase/schema.sql` | **Create.** One-time SQL: `app_state` table + permissive RLS policy. | 2 |
| `.env.example` | **Create.** Documents `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. | 2 |
| `.gitignore` | **Modify.** Ignore real `.env` files (keep `.env.example` tracked). | 2 |
| `src/vite-env.d.ts` | **Create.** Type the two `VITE_*` env vars on `ImportMetaEnv`. | 2 |
| `src/main.tsx` | **Modify.** Build the real client from env and inject `SupabaseRepository` — the swap point. | 2 |

---

## Task 1: SupabaseRepository (TDD)

**Files:**
- Create: `src/data/supabaseRepository.ts`
- Test: `src/data/supabaseRepository.test.ts`
- Modify: `package.json`, `package-lock.json` (add dependency)

**Interfaces:**
- Consumes:
  - `Repository` from `./repository` — `{ load(): Promise<AppData>; save(data: AppData): Promise<void> }`
  - `AppData` from `./types`
  - `seedData(): AppData` from `./seed` (shop `My PCO Shop`, PIN `1234`, 3 wallets, empty drawer/ledgers)
  - `normalizeAppData(data: AppData): AppData` from `./normalize` (defaults missing `transactions`/`cashMovements` to `[]`)
  - `SupabaseClient` type from `@supabase/supabase-js`
- Produces:
  - `export class SupabaseRepository implements Repository` with `constructor(client: SupabaseClient)`. Used by `main.tsx` in Task 2 as `new SupabaseRepository(client)`.

- [ ] **Step 1: Install the Supabase client library**

Run:
```bash
npm install @supabase/supabase-js
```
Expected: `package.json` gains `"@supabase/supabase-js": "^2.x"` under `dependencies`; `package-lock.json` updates. (The library ships its own types — no `@types/...` needed.)

- [ ] **Step 2: Write the failing test (seed-on-empty) + the fake client helper**

Create `src/data/supabaseRepository.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseRepository } from './supabaseRepository'
import { seedData } from './seed'
import type { AppData } from './types'

type FakeRow = { data: AppData } | null
type FakeOpts = { selectError?: unknown; upsertError?: unknown }

/**
 * Minimal hand-written stand-in for the supabase-js client, covering exactly the
 * fluent calls SupabaseRepository uses:
 *   from(table).select(col).eq(col, val).maybeSingle()
 *   from(table).upsert(payload)
 * Backed by one in-memory row. `current()` exposes it for assertions.
 */
function fakeSupabase(initialRow: FakeRow = null, opts: FakeOpts = {}) {
  let row: FakeRow = initialRow
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: row, error: opts.selectError ?? null }),
    upsert: async (payload: { id: number; data: AppData }) => {
      if (opts.upsertError) return { data: null, error: opts.upsertError }
      row = { data: payload.data }
      return { data: null, error: null }
    },
  }
  const client = { from: () => builder } as unknown as SupabaseClient
  return { client, current: () => row }
}

describe('SupabaseRepository', () => {
  it('seeds the singleton row on first load when the table is empty', async () => {
    const { client, current } = fakeSupabase(null)
    const repo = new SupabaseRepository(client)

    const data = await repo.load()

    expect(data.settings.shopName).toBe('My PCO Shop')
    expect(data.settings.pin).toBe('1234')
    expect(data.wallets).toHaveLength(3)
    // the seed was persisted as the id=1 row
    expect(current()).not.toBeNull()
    expect(current()!.data.wallets).toHaveLength(3)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
npx vitest run supabaseRepository
```
Expected: FAIL — `SupabaseRepository` cannot be imported (module `./supabaseRepository` does not exist yet).

- [ ] **Step 4: Write the minimal implementation (load with seed + normalize, save) — no error handling yet**

Create `src/data/supabaseRepository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Repository } from './repository'
import type { AppData } from './types'
import { seedData } from './seed'
import { normalizeAppData } from './normalize'

const TABLE = 'app_state'
const SINGLETON_ID = 1

export class SupabaseRepository implements Repository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async load(): Promise<AppData> {
    const { data } = await this.client
      .from(TABLE)
      .select('data')
      .eq('id', SINGLETON_ID)
      .maybeSingle()

    const row = data as { data: AppData } | null
    if (!row) {
      const seeded = seedData()
      await this.client.from(TABLE).upsert({ id: SINGLETON_ID, data: seeded })
      return seeded
    }
    return normalizeAppData(row.data)
  }

  async save(data: AppData): Promise<void> {
    await this.client.from(TABLE).upsert({ id: SINGLETON_ID, data })
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
npx vitest run supabaseRepository
```
Expected: PASS (1 test).

- [ ] **Step 6: Add the round-trip and normalize-on-load tests**

Append inside the `describe` block in `src/data/supabaseRepository.test.ts`:

```ts
  it('round-trips saved data back on the next load', async () => {
    const { client } = fakeSupabase({ data: seedData() })
    const repo = new SupabaseRepository(client)

    const data = await repo.load()
    data.settings.shopName = 'Persisted Shop'
    await repo.save(data)

    const reloaded = await repo.load()
    expect(reloaded.settings.shopName).toBe('Persisted Shop')
  })

  it('normalizes a legacy row that lacks transactions/cashMovements', async () => {
    // A row written before the transaction ledger existed.
    const legacy = {
      settings: { shopName: 'Old Shop', pin: '1234', denominations: [] },
      wallets: [],
      drawer: {},
    } as unknown as AppData
    const { client } = fakeSupabase({ data: legacy })
    const repo = new SupabaseRepository(client)

    const data = await repo.load()

    expect(data.transactions).toEqual([])
    expect(data.cashMovements).toEqual([])
    expect(data.settings.shopName).toBe('Old Shop')
  })
```

- [ ] **Step 7: Run the tests to verify they pass**

Run:
```bash
npx vitest run supabaseRepository
```
Expected: PASS (3 tests). The minimal implementation already handles seed, round-trip, and normalize.

- [ ] **Step 8: Add the fail-loudly error tests**

Append inside the `describe` block in `src/data/supabaseRepository.test.ts`:

```ts
  it('throws when the select returns an error (fail loudly)', async () => {
    const { client } = fakeSupabase(null, { selectError: new Error('select boom') })
    const repo = new SupabaseRepository(client)

    await expect(repo.load()).rejects.toThrow('select boom')
  })

  it('throws when the upsert returns an error (fail loudly)', async () => {
    const { client } = fakeSupabase({ data: seedData() }, { upsertError: new Error('upsert boom') })
    const repo = new SupabaseRepository(client)

    await expect(repo.save(seedData())).rejects.toThrow('upsert boom')
  })
```

- [ ] **Step 9: Run the tests to verify the two new ones fail**

Run:
```bash
npx vitest run supabaseRepository
```
Expected: FAIL — the two new tests fail because `load()`/`save()` ignore the `error` field and do not throw yet (the others still pass).

- [ ] **Step 10: Add fail-loudly error handling to load and save**

Edit `src/data/supabaseRepository.ts` — replace the `load` and `save` method bodies:

```ts
  async load(): Promise<AppData> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('data')
      .eq('id', SINGLETON_ID)
      .maybeSingle()
    if (error) throw error

    const row = data as { data: AppData } | null
    if (!row) {
      const seeded = seedData()
      const { error: insertError } = await this.client
        .from(TABLE)
        .upsert({ id: SINGLETON_ID, data: seeded })
      if (insertError) throw insertError
      return seeded
    }
    return normalizeAppData(row.data)
  }

  async save(data: AppData): Promise<void> {
    const { error } = await this.client.from(TABLE).upsert({ id: SINGLETON_ID, data })
    if (error) throw error
  }
```

- [ ] **Step 11: Run the full repository test file to verify all pass**

Run:
```bash
npx vitest run supabaseRepository
```
Expected: PASS (5 tests).

- [ ] **Step 12: Run the build, lint, and full test suite**

Run:
```bash
npm run build
npm run lint
npm test
```
Expected: all green. `npm run build` confirms `erasableSyntaxOnly` (no parameter property) and `verbatimModuleSyntax` (all `import type`) are satisfied and there are no unused locals.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json src/data/supabaseRepository.ts src/data/supabaseRepository.test.ts
git commit -m "feat(data): add SupabaseRepository (JSONB blob, seed/normalize, fail-loudly)"
```

---

## Task 2: Wire SupabaseRepository into the app (the swap)

**Files:**
- Create: `supabase/schema.sql`, `.env.example`, `src/vite-env.d.ts`
- Modify: `.gitignore`, `src/main.tsx`

**Interfaces:**
- Consumes:
  - `SupabaseRepository` from `./data/supabaseRepository` (Task 1) — `new SupabaseRepository(client)`
  - `createClient(url: string, key: string): SupabaseClient` from `@supabase/supabase-js`
  - `useAppStore.getState().init(repo: Repository): Promise<void>` from `./store/appStore` (unchanged)
  - `import.meta.env.VITE_SUPABASE_URL`, `import.meta.env.VITE_SUPABASE_ANON_KEY`
- Produces: the running app persists to Supabase. No new code symbols are consumed by later tasks (this is the final task).

- [ ] **Step 1: Create the database schema file**

Create `supabase/schema.sql`:

```sql
-- Phase 2B: single-row JSONB store for the whole AppData blob.
-- Apply once in the Supabase dashboard (SQL editor).

create table app_state (
  id         int primary key default 1,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_state_singleton check (id = 1)
);

alter table app_state enable row level security;

-- Anon read/write on the single row. The PIN gate stays client-side.
-- See the spec's "Security tradeoff" section: the anon key is public, so this
-- policy is effectively open — acceptable for one shop's internal ledger, and
-- hardenable later without domain/UI changes.
create policy app_state_rw on app_state
  for all
  using (true)
  with check (true);
```

- [ ] **Step 2: Create the env template**

Create `.env.example`:

```
# Supabase project credentials — Supabase dashboard → Project Settings → API.
# Copy this file to `.env` and fill in real values. `.env` is git-ignored.
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

- [ ] **Step 3: Ignore real env files (keep `.env.example` tracked)**

Edit `.gitignore` — add these lines under the `*.local` line (around line 13):

```
# Local env files (real Supabase keys) — .env.example stays tracked
.env
.env.local
.env.*.local
```

- [ ] **Step 4: Type the env vars**

Create `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}
```

- [ ] **Step 5: Swap the repository in `main.tsx`**

Replace the entire contents of `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import App from './App'
import './index.css'
import { useAppStore } from './store/appStore'
import { SupabaseRepository } from './data/supabaseRepository'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example).',
  )
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)
useAppStore.getState().init(new SupabaseRepository(supabase))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

- [ ] **Step 6: Run the build to verify types**

Run:
```bash
npm run build
```
Expected: PASS. `tsc -b` resolves `createClient`, the injected `SupabaseClient`, and the `VITE_*` env vars (now typed as `string` via `src/vite-env.d.ts`); `vite build` produces a bundle. (The build does not require a real `.env` — `import.meta.env.*` is inlined and the missing-env `throw` is runtime-only.)

- [ ] **Step 7: Run lint and the full test suite**

Run:
```bash
npm run lint
npm test
```
Expected: both green. No existing test imports `main.tsx`, so the swap does not affect the suite; this confirms nothing else regressed.

- [ ] **Step 8: Manual smoke (requires real Supabase project)**

This step is manual and needs a real Supabase project; it is not automated.
1. In the Supabase dashboard SQL editor, run `supabase/schema.sql` once.
2. Copy `.env.example` to `.env` and fill in the real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run `npm run dev`, open the app, log in with PIN `1234`.
4. On first load the `app_state` row is seeded; add a transaction, then hard-reload the page.
   Expected: the transaction and balances survive the reload (data is in Postgres, not localStorage). In the Supabase table editor, `app_state` has one row whose `data` reflects the change.
5. (Optional) Confirm fail-loudly: with a wrong `VITE_SUPABASE_URL`, the app surfaces a load error rather than silently showing seed data.

- [ ] **Step 9: Commit**

```bash
git add supabase/schema.sql .env.example .gitignore src/vite-env.d.ts src/main.tsx
git commit -m "feat: swap LocalStorageRepository for SupabaseRepository at the injection point"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-23-pco-phase2b-supabase-repository-design.md`):

- §2/§4 `SupabaseRepository implements Repository` in `src/data/` → Task 1.
- §5 `app_state` table + RLS → Task 2 Step 1 (`supabase/schema.sql`).
- §6 load semantics (error→throw; row→normalize; null→seed+upsert) → Task 1 Steps 4/10; tests Steps 2/6/8.
- §6 save semantics (upsert; error→throw) → Task 1 Steps 4/10; test Step 8.
- §7 security tradeoff → documented in `supabase/schema.sql` comment (Task 2 Step 1) and the spec.
- §9 all five test cases (seed, round-trip, normalize, load-error, save-error) → Task 1 Steps 2/6/8.
- §10 dependency / env / `ImportMetaEnv` / `.env.example` / `main.tsx` swap → Task 2 Steps 1–5.
- §11 success criteria → Task 1 Step 12 + Task 2 Steps 6–8.
- §8 deferred items (relational schema, realtime, offline cache, data migration) → intentionally absent from both tasks. ✓

No gaps.

**2. Placeholder scan:** No "TBD"/"TODO"/"handle edge cases"/"similar to Task N". Every code step shows complete code. ✓

**3. Type consistency:** `SupabaseRepository` constructor signature `(client: SupabaseClient)` is identical in Task 1 (definition) and Task 2 (`new SupabaseRepository(supabase)`). Table name `app_state` and `SINGLETON_ID = 1` match between `supabaseRepository.ts` and `supabase/schema.sql`. The fake client's `select`/`eq`/`maybeSingle`/`upsert` shape matches the calls in `load`/`save`. Env var names `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are identical across `vite-env.d.ts`, `.env.example`, and `main.tsx`. ✓
