# PCO Phase 4A — Count & Verify (Drawer Reconciliation) Design Spec

**Date:** 2026-06-23
**Status:** Approved (design); pending spec review
**Author:** Brainstormed with shop owner (Awais Malik)

---

## 1. Purpose

Let the owner physically count the cash drawer and reconcile it against what the
app expects, so the **golden invariant** (`Total Cash by notes === Σ cash movements`)
reflects physical reality. This is the one explicit success criterion from the
master design spec still unmet:

> "A drawer count that doesn't match expected is clearly flagged."

This is sub-phase **4A** of Phase 4. Phase 4 was decomposed into five independent
sub-phases, each its own spec → plan → build cycle:

- **4A — Count & Verify** (this spec)
- 4B — Reports (day/week/month aggregations)
- 4C — Settings polish (note threshold, denomination management, data backup/export)
- 4D — PWA install (manifest, service worker, icons)
- 4E — Final UX pass (polish, empty/loading states)

## 2. Decisions (from brainstorming)

1. **Mismatch behavior — reconcile to counted.** The physical count becomes the
   new truth. When counted ≠ expected, the app updates the drawer per-denomination
   to match what was counted and records the difference as a `'count'` cash
   movement with a required reason. The golden invariant is preserved by
   construction.
2. **Save every count.** Every verification is saved to a count history — even a
   perfect match — so the owner can prove when they last reconciled and spot a
   pattern of recurring shortfalls. A reason is required only when there is a
   difference; matched counts save with no reason.
3. **Count entry starts empty.** The per-denomination inputs begin at 0; the owner
   keys in exactly what they physically count. This forces a real count and
   surfaces discrepancies honestly. The counted total updates live as notes are
   entered.

## 3. Architecture

Follows the established Phase 2/3 layering: **domain ← data ← store ← UI**, lower
layers never importing upward. A new pure domain module (`count.ts`) mirrors the
shape of `expense.ts` / `udhar.ts`: a pure, immutable function takes `AppData` plus
an input record and returns new `AppData`, generating a `CashMovement` for the cash
change. Ids and timestamps are passed in (generated only in the store action).

### 3.1 Data model

**New entity — `Count`** (one row per verification):

```ts
interface Count {
  id: string
  expectedTotal: Paisa   // totalCash(drawer) at the moment of the count
  countedTotal: Paisa    // totalCash(countedNotes)
  difference: Paisa      // countedTotal − expectedTotal (signed; − = short, + = over)
  note?: string          // reason; required by UI when difference !== 0
  createdAt: string
}
```

**`AppData` gains** `counts: Count[]`. As with Phase 3's new arrays, `normalize.ts`
back-fills `counts: []` for older persisted data — no Supabase migration (it's one
JSONB blob).

**`CashMovement.sourceType`** is widened to add `'count'`:
`'transaction' | 'adjustment' | 'kharcha' | 'udhar' | 'count'`. A reconciliation
appears in the unified cash ledger (and the Cash page's "Recent cash movements")
as a `count` movement.

`Settings` is unchanged.

### 3.2 Domain — new `src/domain/count.ts`

```ts
interface CountInput {
  id: string
  createdAt: string
  countedNotes: Record<number, number>   // per-denomination physical count
  note?: string
}

function applyCount(data: AppData, input: CountInput): AppData
```

`applyCount` behavior (pure, immutable, deterministic):

- `expected = totalCash(data.drawer)`
- `counted = totalCash(input.countedNotes)`
- `difference = counted − expected`
- **If `difference !== 0`:**
  - Compute the per-denomination delta `noteDelta = countedNotes − drawer` across
    the union of denominations present in either map (a new `diffNotes(target,
    current)` helper in `cash.ts`).
  - Apply it via `applyNoteDelta(drawer, noteDelta)` so the drawer **becomes** the
    counted notes.
  - Prepend a `CashMovement` with id `${input.id}-c`, `sourceType: 'count'`,
    `delta: difference`, `notes: noteDelta`, `sourceId: input.id`, `createdAt:
    input.createdAt` to `data.cashMovements`.
- **If `difference === 0`:** drawer untouched, no cash movement.
- **Always** prepend a `Count` snapshot to `data.counts`.

**Golden invariant.** The drawer changes by exactly `noteDelta` whose value is
`difference`, matched by the movement's `delta`. So `totalCash(drawer) === Σ
cashMovements.delta` continues to hold. There is **no `NEGATIVE_NOTES` risk**: the
drawer is set to the physically-counted notes, which are always ≥ 0
(`applyNoteDelta(drawer, countedNotes − drawer)` = `countedNotes`).

**New helper — `diffNotes`** in `src/domain/cash.ts`:

```ts
/** Per-denomination signed delta to turn `current` into `target`. */
function diffNotes(
  target: Record<number, number>,
  current: Record<number, number>,
): Record<number, number>
```

Returns `target[v] − current[v]` for every denomination value `v` appearing in
either map, omitting entries whose delta is 0.

### 3.3 Store — `src/store/appStore.ts`

```ts
recordCount(input: Omit<CountInput, 'id' | 'createdAt'>): Promise<void>
```

Standard action pattern: guard `if (!repo || !data) return`; generate
`id = crypto.randomUUID()`, `createdAt = new Date().toISOString()`; call
`applyCount(data, full)`; `await repo.save(next)`; `set({ data: next })`.

### 3.4 UI

**New page — `src/pages/CountDrawer.tsx`** at route `/count`:

- Reuses `NotePicker` (starts empty) for the counted notes.
- Live summary panel:
  - **Expected** = current drawer total (`formatPKR`)
  - **Counted** = live sum of entered notes
  - **Difference** = counted − expected, labeled `Short` (negative), `Over`
    (positive), or `Matches ✓` (zero)
- **Reason** input — required and enabled only when the difference is non-zero;
  hidden/disabled when it matches.
- **Confirm & Reconcile** button — disabled until the count is actionable (and,
  on mismatch, until a reason is entered). On click → `recordCount` → success
  state → navigate back to Dashboard (`/`).
- **Count History** list below: each row shows date, counted total, and either
  `✓ matched` or `±diff "reason"`. Most recent first.

**Wiring:**

- **Dashboard** (`src/pages/Dashboard.tsx`) — add the spec's planned "Count
  Drawer" quick-action button linking to `/count`, alongside the existing
  Kharcha/Udhari quick-actions.
- **Cash & Notes page** (`src/pages/Cash.tsx`) — add a "Count & Verify" button
  near the top linking to `/count`.
- **`src/App.tsx`** — register the `/count` route under `AppLayout`.

## 4. Testing

- **Domain (`count.test.ts`):**
  - Matched count → no `CashMovement`, drawer unchanged, one `Count` snapshot with
    `difference === 0`.
  - Short count → drawer corrected down to counted, one `'count'` movement with
    negative `delta`, golden invariant holds (`totalCash(drawer) === Σ
    cashMovements.delta`).
  - Over count → drawer up to counted, positive `delta` movement.
  - Drawer becomes exactly the counted notes (per-denomination assertion).
  - `Count` snapshot records correct `expectedTotal` / `countedTotal` /
    `difference`.
- **`diffNotes` (`cash.test.ts`):** signed deltas across the union of values; zero
  deltas omitted.
- **Store (`appStore.test.ts`):** `recordCount` appends to `counts` and
  `cashMovements`, updates `drawer`, and persists through the repository
  (`repo.load()` assertion).
- **Back-compat (`normalize.test.ts`):** old data without `counts` gets `counts:
  []`.
- **Page (`CountDrawer.test.tsx`):** live difference display updates as notes are
  entered; reason required on mismatch; history list renders.

## 5. Constraints (inherited from CLAUDE.md)

- Integer paisa everywhere; `toPaisa()` on input, `formatPKR()` on display.
- Domain pure/immutable/deterministic; ids and timestamps passed in.
- `verbatimModuleSyntax` ON — type-only imports use `import type`.
- `npm run build` is the type-check gate; run before declaring done.
- Zustand v5 — no store selectors returning fresh objects/arrays; derive with
  `useMemo` in the component.

## 6. Out of scope (for 4A)

- Reports, Settings polish, PWA, final UX pass (sub-phases 4B–4E).
- Editing or deleting a past count (counts are an immutable audit trail; a wrong
  count is corrected by performing another count).
- Partial counts (counting only some denominations) — the count always represents
  the whole drawer.

## 7. Success criteria

- After a mismatched count is confirmed, `totalCash(drawer)` equals the counted
  total and `Σ cashMovements.delta` still equals `totalCash(drawer)`.
- A matched count leaves the drawer and cash ledger unchanged but is recorded in
  the count history.
- The count history shows every verification with its date, counted total, and
  difference/reason.
- Count & Verify is reachable from both the Dashboard and the Cash page.
