# PCO Phase 4A — Count & Verify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner physically count the cash drawer and reconcile it against the app's expected total, recording the difference as a `'count'` cash movement so the golden invariant always reflects physical reality.

**Architecture:** A new pure domain module (`count.ts`) mirrors `expense.ts`: `applyCount(data, input)` takes `AppData` plus a count input and returns new `AppData`, setting the drawer to the physically-counted notes and logging a `CashMovement` for the difference. A new `diffNotes` helper in `cash.ts` computes the per-denomination delta. A `recordCount` store action generates id/timestamp and delegates. A `/count` page reuses `NotePicker` and is reachable from the Dashboard and Cash pages. `counts: Count[]` is added to `AppData`, seeded and back-filled like Phase 3's arrays.

**Tech Stack:** React 18 + TypeScript (Vite), Zustand v5, React Router, Tailwind v3, Vitest + jsdom + jest-dom, Supabase (single JSONB row).

## Global Constraints

Copied from `CLAUDE.md` / the spec — every task's requirements implicitly include these:

- **Integer paisa everywhere.** All money is `Paisa` (rupees × 100). Convert only at the UI edge: `toPaisa()` on input, `formatPKR()` on display.
- **The golden invariant:** `totalCash(drawer) === Σ cashMovements[].delta`. Every drawer change creates a `CashMovement` whose `delta` matches. A matched count (difference 0) changes neither.
- **Domain functions are pure, immutable, deterministic.** Return new objects, never mutate inputs, never call `crypto.randomUUID()` / `new Date()` — `id` and `createdAt` are passed *in*. Only store actions generate ids/timestamps.
- **`verbatimModuleSyntax` is ON** (plus `noUnusedLocals`/`noUnusedParameters`). Every type-only import MUST be `import type { … }`. Unused imports/vars fail the build.
- **`applyNoteDelta` throws `Error('NEGATIVE_NOTES')`** when a denomination would go negative. (Not reachable in `applyCount` — the drawer is set to counted notes, always ≥ 0 — but the UI still uses a try/catch defensively.)
- **`npm test` does NOT type-check.** Run `npm run build` (`tsc -b && vite build`) before declaring any task done. The build type-checks test files too — adding a required field to `AppData` breaks every typed `AppData` literal until updated.
- **Architecture flow:** domain ← data ← store ← UI. Lower layers never import upward (domain may import sibling domain modules and the `AppData` *type*).
- **Zustand v5 trap:** never write a store selector that returns a fresh object/array — it causes infinite re-renders. Derive such values in the component with `useMemo` over the raw slice.

**Commands:**
- One test file: `npx vitest run <pattern>` (substring match on path)
- Full suite: `npm test`
- Type-check + build gate: `npm run build`
- Lint: `npm run lint`

---

## File Map

**Create:**
- `src/domain/count.ts` — `Count`, `CountInput`, `applyCount`
- `src/domain/count.test.ts`
- `src/pages/CountDrawer.tsx` + `src/pages/CountDrawer.test.tsx`

**Modify:**
- `src/domain/cash.ts` — add `diffNotes`; `cash.test.ts` — test it
- `src/domain/transaction.ts:26` — widen `CashMovement['sourceType']` to add `'count'`
- `src/data/types.ts` — `AppData.counts: Count[]`
- `src/data/seed.ts` — seed `counts: []`
- `src/data/normalize.ts` — back-fill `counts`; `normalize.test.ts` — test
- `src/store/appStore.ts` — `recordCount` action; `appStore.test.ts` — test
- `src/App.tsx` — `/count` route
- `src/pages/Dashboard.tsx` — "Count Drawer" quick-action link
- `src/pages/Cash.tsx` — "Count & Verify" button
- `CLAUDE.md` — Phase 4A status + new module

---

## Task 1: Data-model foundation (`Count` type, `diffNotes`, back-compat)

Lay down the shared type, the cash helper, and the `AppData` field so later tasks add only functions and the build stays green.

**Files:**
- Create: `src/domain/count.ts` (interfaces only)
- Modify: `src/domain/cash.ts` (add `diffNotes`)
- Test: `src/domain/cash.test.ts`
- Modify: `src/domain/transaction.ts:26` (widen `sourceType`)
- Modify: `src/data/types.ts`
- Modify: `src/data/seed.ts`
- Modify: `src/data/normalize.ts`
- Test: `src/data/normalize.test.ts`

**Interfaces produced (later tasks rely on these exact names/types):**
- `interface Count { id: string; expectedTotal: Paisa; countedTotal: Paisa; difference: Paisa; note?: string; createdAt: string }` (count.ts)
- `function diffNotes(target: Record<number, number>, current: Record<number, number>): Record<number, number>` (cash.ts)
- `CashMovement['sourceType']` widened to `'transaction' | 'adjustment' | 'kharcha' | 'udhar' | 'count'`
- `AppData` gains `counts: Count[]`

- [ ] **Step 1: Write the failing test for `diffNotes`**

Append to `src/domain/cash.test.ts` (add `diffNotes` to the existing import from `./cash`):

```typescript
describe('diffNotes', () => {
  it('returns the signed per-denomination delta to reach target from current', () => {
    expect(diffNotes({ 100: 5, 50: 2 }, { 100: 3, 50: 2 })).toEqual({ 100: 2 })
  })
  it('includes negative deltas and values present only on one side', () => {
    expect(diffNotes({ 100: 1, 500: 0 }, { 100: 3, 50: 1 })).toEqual({ 100: -2, 50: -1 })
  })
  it('returns an empty map when target equals current', () => {
    expect(diffNotes({ 100: 3 }, { 100: 3 })).toEqual({})
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run cash`
Expected: FAIL — `diffNotes is not a function` / not exported.

- [ ] **Step 3: Implement `diffNotes` in `src/domain/cash.ts`**

Append to `src/domain/cash.ts`:

```typescript
/** Per-denomination signed delta to turn `current` into `target`. Omits zero deltas. */
export function diffNotes(
  target: Record<number, number>,
  current: Record<number, number>,
): Record<number, number> {
  const out: Record<number, number> = {}
  const values = new Set<number>([
    ...Object.keys(target).map(Number),
    ...Object.keys(current).map(Number),
  ])
  for (const v of values) {
    const delta = (target[v] ?? 0) - (current[v] ?? 0)
    if (delta !== 0) out[v] = delta
  }
  return out
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run cash`
Expected: PASS.

- [ ] **Step 5: Create `src/domain/count.ts` (types only)**

```typescript
import type { Paisa } from './money'

/** One drawer verification snapshot. Immutable audit record. */
export interface Count {
  id: string
  /** totalCash(drawer) at the moment of the count. */
  expectedTotal: Paisa
  /** totalCash(countedNotes). */
  countedTotal: Paisa
  /** countedTotal − expectedTotal (signed; negative = short, positive = over). */
  difference: Paisa
  /** Reason; required by the UI when difference !== 0. */
  note?: string
  createdAt: string
}

export interface CountInput {
  id: string
  createdAt: string
  /** Per-denomination physical count of the whole drawer. */
  countedNotes: Record<number, number>
  note?: string
}
```

- [ ] **Step 6: Widen `CashMovement['sourceType']` in `src/domain/transaction.ts`**

Change line 26 inside `interface CashMovement`:

```typescript
  sourceType: 'transaction' | 'adjustment' | 'kharcha' | 'udhar' | 'count'
```

- [ ] **Step 7: Extend `src/data/types.ts`**

Add the import (with the others at the top). Add after line 6:

```typescript
import type { Count } from '../domain/count'
```

Add `counts: Count[]` to the `AppData` interface (after `expenses`):

```typescript
export interface AppData {
  settings: Settings
  wallets: Wallet[]
  drawer: DrawerCounts
  transactions: Transaction[]
  cashMovements: CashMovement[]
  persons: Person[]
  udharEntries: UdharEntry[]
  expenses: Expense[]
  counts: Count[]
}
```

- [ ] **Step 8: Seed the new field in `src/data/seed.ts`**

Add `counts: []` to the returned object (after `expenses: []`):

```typescript
    expenses: [],
    counts: [],
  }
}
```

- [ ] **Step 9: Write the failing back-compat test in `src/data/normalize.test.ts`**

Add a test inside the existing `describe('normalizeAppData', …)`:

```typescript
  it('back-fills counts for old data', () => {
    const old = {
      settings: { shopName: 'X', pin: '1234', denominations: [], expenseCategories: [] },
      wallets: [],
      drawer: {},
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const n = normalizeAppData(old)
    expect(n.counts).toEqual([])
  })
```

- [ ] **Step 10: Run it to confirm it fails**

Run: `npx vitest run normalize`
Expected: FAIL — `n.counts` is `undefined`.

- [ ] **Step 11: Update `src/data/normalize.ts`**

Add `counts: data.counts ?? [],` to the returned object (after the `expenses` line):

```typescript
    persons: data.persons ?? [],
    udharEntries: data.udharEntries ?? [],
    expenses: data.expenses ?? [],
    counts: data.counts ?? [],
  }
}
```

- [ ] **Step 12: Run the full suite + build gate**

Run: `npm test`
Expected: PASS (all existing + new tests). `npm test` does not type-check, so typed `AppData` literals missing `counts` still pass here.
Run: `npm run build`
Expected: no type errors. **If the build flags a test file with a typed `AppData` literal missing `counts`, add `counts: []` to that literal.** (Known literals to check: `transaction.test.ts` `baseData()`, `expense.test.ts` `baseData()`, `udhar.test.ts` `baseData()`, and any `AppData` literal in `summary.test.ts`. Add `counts: []` to each that the build names.)

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(phase4a): data-model foundation for count & verify"
```

---

## Task 2: Count domain — `applyCount`

**Files:**
- Modify: `src/domain/count.ts` (add `applyCount`)
- Test: `src/domain/count.test.ts`

**Interfaces:**
- Consumes: `AppData` (data/types), `totalCash`, `applyNoteDelta`, `diffNotes` (cash), `CashMovement` (transaction), `Count`, `CountInput` (own module).
- Produces: `applyCount(data: AppData, input: CountInput): AppData`

**Behaviour:** `expected = totalCash(drawer)`, `counted = totalCash(countedNotes)`, `difference = counted − expected`. If `difference !== 0`: `noteDelta = diffNotes(countedNotes, drawer)`, set drawer via `applyNoteDelta(drawer, noteDelta)` (drawer becomes counted), push a `'count'` `CashMovement` with id `${input.id}-c`. If `difference === 0`: no movement, drawer unchanged. Always prepend a `Count` snapshot.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/count.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import { applyCount, type CountInput } from './count'

function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: [] },
    wallets: [],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 1000: 5, 100: 8 }, // Rs 5000 + 800 = 5800
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
  }
}

function input(over: Partial<CountInput> = {}): CountInput {
  return { id: 'cnt1', createdAt: '2026-06-23T10:00:00.000Z', countedNotes: {}, ...over }
}

describe('applyCount', () => {
  it('matched count: no movement, drawer unchanged, snapshot with difference 0', () => {
    const data = baseData()
    const next = applyCount(data, input({ countedNotes: { 1000: 5, 100: 8 } }))
    expect(next.cashMovements).toHaveLength(0)
    expect(next.drawer).toEqual(data.drawer)
    expect(next.counts).toHaveLength(1)
    expect(next.counts[0].difference).toBe(0)
    expect(next.counts[0].expectedTotal).toBe(5800_00)
    expect(next.counts[0].countedTotal).toBe(5800_00)
  })

  it('short count: drawer corrected down, negative count movement, golden invariant holds', () => {
    const data = baseData()
    // physically only 4 × 1000 and 8 × 100 = Rs 4800 (Rs 1000 short)
    const next = applyCount(data, input({ countedNotes: { 1000: 4, 100: 8 }, note: 'missing note' }))
    expect(next.drawer[1000]).toBe(4)
    expect(next.drawer[100]).toBe(8)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].sourceType).toBe('count')
    expect(next.cashMovements[0].delta).toBe(-1000_00)
    expect(next.counts[0].difference).toBe(-1000_00)
    expect(next.counts[0].note).toBe('missing note')
    expect(totalCash(next.drawer)).toBe(4800_00)
    const movementSum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(data.drawer) + movementSum).toBe(totalCash(next.drawer))
  })

  it('over count: drawer up, positive movement', () => {
    const data = baseData()
    // physically 6 × 1000 and 8 × 100 = Rs 6800 (Rs 1000 over)
    const next = applyCount(data, input({ countedNotes: { 1000: 6, 100: 8 }, note: 'found note' }))
    expect(next.drawer[1000]).toBe(6)
    expect(next.cashMovements[0].delta).toBe(1000_00)
    expect(next.counts[0].difference).toBe(1000_00)
  })

  it('drawer becomes exactly the counted notes', () => {
    const data = baseData()
    const next = applyCount(data, input({ countedNotes: { 5000: 1, 500: 2 }, note: 'recount' }))
    expect(next.drawer[5000]).toBe(1)
    expect(next.drawer[500]).toBe(2)
    expect(next.drawer[1000]).toBe(0)
    expect(next.drawer[100]).toBe(0)
  })

  it('does not mutate the input data', () => {
    const data = baseData()
    applyCount(data, input({ countedNotes: { 1000: 4, 100: 8 } }))
    expect(data.drawer[1000]).toBe(5)
    expect(data.counts).toHaveLength(0)
    expect(data.cashMovements).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run count`
Expected: FAIL — `applyCount is not a function`.

- [ ] **Step 3: Implement `applyCount` in `src/domain/count.ts`**

Add the imports at the top (keep the existing `import type { Paisa }`):

```typescript
import type { AppData } from '../data/types'
import type { CashMovement } from './transaction'
import { totalCash, applyNoteDelta, diffNotes } from './cash'
```

Add the function at the bottom:

```typescript
/** Reconcile the drawer to a physical count. Pure/immutable. Always records a Count snapshot;
 *  records a 'count' CashMovement only when the count differs from the expected drawer total. */
export function applyCount(data: AppData, input: CountInput): AppData {
  const expectedTotal: Paisa = totalCash(data.drawer)
  const countedTotal: Paisa = totalCash(input.countedNotes)
  const difference: Paisa = countedTotal - expectedTotal

  const count: Count = {
    id: input.id,
    expectedTotal,
    countedTotal,
    difference,
    note: input.note,
    createdAt: input.createdAt,
  }

  if (difference === 0) {
    return { ...data, counts: [count, ...data.counts] }
  }

  const noteDelta = diffNotes(input.countedNotes, data.drawer)
  const drawer = applyNoteDelta(data.drawer, noteDelta)
  const movement: CashMovement = {
    id: `${input.id}-c`,
    sourceType: 'count',
    sourceId: input.id,
    delta: difference,
    notes: noteDelta,
    note: input.note,
    createdAt: input.createdAt,
  }
  return {
    ...data,
    drawer,
    counts: [count, ...data.counts],
    cashMovements: [movement, ...data.cashMovements],
  }
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx vitest run count`
Expected: PASS (5 tests).

- [ ] **Step 5: Build gate**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/count.ts src/domain/count.test.ts
git commit -m "feat(phase4a): applyCount domain function"
```

---

## Task 3: Store action — `recordCount`

**Files:**
- Modify: `src/store/appStore.ts`
- Test: `src/store/appStore.test.ts`

**Interfaces:**
- Consumes: `applyCount`, `CountInput` (domain/count).
- Produces: `recordCount(input: Omit<CountInput, 'id' | 'createdAt'>): Promise<void>` on the store.

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `src/store/appStore.test.ts` (the file already imports `InMemoryRepository`, `seedData`, `useAppStore`):

```typescript
describe('appStore count', () => {
  it('recordCount with a difference updates drawer + counts + a count movement; persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } }) // Rs 5000

    await useAppStore.getState().recordCount({ countedNotes: { 1000: 4 }, note: 'short' }) // Rs 4000

    const data = useAppStore.getState().data!
    expect(data.counts).toHaveLength(1)
    expect(data.counts[0].difference).toBe(-1000_00)
    expect(data.drawer[1000]).toBe(4)
    expect(data.cashMovements).toHaveLength(1)
    expect(data.cashMovements[0].sourceType).toBe('count')
    expect(data.cashMovements[0].delta).toBe(-1000_00)
    const reloaded = await repo.load()
    expect(reloaded.counts).toHaveLength(1)
  })

  it('recordCount with a matched count records a snapshot but no movement', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } })

    await useAppStore.getState().recordCount({ countedNotes: { 1000: 5 } })

    const data = useAppStore.getState().data!
    expect(data.counts).toHaveLength(1)
    expect(data.counts[0].difference).toBe(0)
    expect(data.cashMovements).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run appStore`
Expected: FAIL — `recordCount is not a function`.

- [ ] **Step 3: Add imports + interface member + action**

In `src/store/appStore.ts`, after the udhar import lines (lines 11-12), add:

```typescript
import { applyCount } from '../domain/count'
import type { CountInput } from '../domain/count'
```

Add to the `AppState` interface (after `deleteUdhar`):

```typescript
  recordCount: (input: Omit<CountInput, 'id' | 'createdAt'>) => Promise<void>
```

Add the action implementation inside the store object (after the `deleteUdhar` action, before the closing `}))`):

```typescript
  async recordCount(input) {
    const { repo, data } = get()
    if (!repo || !data) return
    const full: CountInput = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    const next = applyCount(data, full)
    await repo.save(next)
    set({ data: next })
  },
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx vitest run appStore`
Expected: PASS.

- [ ] **Step 5: Build gate**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts
git commit -m "feat(phase4a): recordCount store action"
```

---

## Task 4: Count page + route + wiring

**Files:**
- Create: `src/pages/CountDrawer.tsx`
- Test: `src/pages/CountDrawer.test.tsx`
- Modify: `src/App.tsx` (route)
- Modify: `src/pages/Dashboard.tsx` (quick-action)
- Modify: `src/pages/Cash.tsx` (button)

**Interfaces:**
- Consumes: `useAppStore` + `recordCount`, `selectTotalCash` (store); `NotePicker` (components); `formatPKR` (money); `totalCash` (cash).

- [ ] **Step 1: Create `src/pages/CountDrawer.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, selectTotalCash } from '../store/appStore'
import { formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import NotePicker from '../components/NotePicker'

export default function CountDrawer() {
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const expected = useAppStore(selectTotalCash)
  const recordCount = useAppStore((s) => s.recordCount)

  const [counted, setCounted] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countedTotal = useMemo(() => totalCash(counted), [counted])
  const difference = countedTotal - expected
  const counts = data?.counts ?? []

  if (!data) return <div className="p-8">Loading…</div>

  const denominations = data.settings.denominations
  const needsReason = difference !== 0
  const canSubmit = !loading && (!needsReason || reason.trim().length > 0)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await recordCount({ countedNotes: counted, note: needsReason ? reason.trim() : undefined })
      navigate('/')
    } catch {
      setError('Could not save the count. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Count &amp; Verify</h1>
        <p className="text-sm text-slate-500">Count the drawer note by note.</p>
      </header>

      <NotePicker
        label="Counted Notes"
        denominations={denominations}
        counts={counted}
        onChange={setCounted}
      />

      <section className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
        <div className="flex justify-between"><span>Expected</span><span className="font-semibold">{formatPKR(expected)}</span></div>
        <div className="flex justify-between"><span>Counted</span><span className="font-semibold">{formatPKR(countedTotal)}</span></div>
        <div className="flex justify-between">
          <span>Difference</span>
          <span className={`font-bold ${difference === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {difference === 0 ? 'Matches ✓' : `${difference > 0 ? 'Over +' : 'Short '}${formatPKR(difference)}`}
          </span>
        </div>
      </section>

      {needsReason && (
        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="reason" className="mb-2 block text-sm font-semibold text-slate-600">
            Reason (required)
          </label>
          <input
            id="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., chai, found note, miscount"
          />
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => navigate('/')} className="rounded-xl bg-slate-200 py-3 font-semibold">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`rounded-xl py-3 font-semibold text-white ${canSubmit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400 cursor-not-allowed'}`}
        >
          {loading ? 'Saving…' : 'Confirm & Reconcile'}
        </button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Count History</h2>
        {counts.length === 0 && <p className="text-sm text-slate-500">No counts yet.</p>}
        <ul className="space-y-1">
          {counts.slice(0, 20).map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm">
              <span className="text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
              <span className="font-semibold">{formatPKR(c.countedTotal)}</span>
              <span className={c.difference === 0 ? 'text-emerald-600' : 'text-red-600'}>
                {c.difference === 0 ? '✓ matched' : `${c.difference > 0 ? '+' : ''}${formatPKR(c.difference)}${c.note ? ` "${c.note}"` : ''}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Add the route in `src/App.tsx`**

Add the import after the `PersonDetail` import (line 12):

```typescript
import CountDrawer from './pages/CountDrawer'
```

Add the route inside `<Route element={<AppLayout />}>` (after the `udhari/:personId` route):

```tsx
        <Route path="count" element={<CountDrawer />} />
```

- [ ] **Step 3: Add the Dashboard quick-action**

In `src/pages/Dashboard.tsx`, add a "Count Drawer" link inside the quick-action `<section>` (after the `/udhari` link, before `/cash`):

```tsx
        <Link to="/count" className="rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
          Count Drawer
        </Link>
```

- [ ] **Step 4: Add the Cash page button**

In `src/pages/Cash.tsx`, add the import at the top:

```typescript
import { Link } from 'react-router-dom'
```

Add a button right after the opening `<h1>Cash &amp; Notes</h1>` line, inside the top `<div className="space-y-4">`:

```tsx
      <Link to="/count" className="block rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white">
        Count &amp; Verify
      </Link>
```

- [ ] **Step 5: Write the page test**

Create `src/pages/CountDrawer.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import CountDrawer from './CountDrawer'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 100: 10 } } }) // Rs 1000
})

function renderPage() {
  return render(
    <MemoryRouter>
      <CountDrawer />
    </MemoryRouter>,
  )
}

describe('CountDrawer page', () => {
  it('shows the live difference as notes are counted', () => {
    renderPage()
    fireEvent.click(screen.getByLabelText('add Rs 100')) // counted Rs 100 vs expected Rs 1000
    expect(screen.getByText(/Short/i)).toBeInTheDocument()
  })

  it('requires a reason when the count does not match', async () => {
    renderPage()
    fireEvent.click(screen.getByLabelText('add Rs 100')) // mismatch
    const confirm = screen.getByRole('button', { name: /confirm & reconcile/i })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'miscount' } })
    expect(confirm).not.toBeDisabled()
    fireEvent.click(confirm)
    await waitFor(() => {
      expect(useAppStore.getState().data!.counts).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.counts[0].note).toBe('miscount')
    expect(useAppStore.getState().data!.drawer[100]).toBe(1)
  })

  it('reconciles a matched count without a reason and records a snapshot', async () => {
    renderPage()
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByLabelText('add Rs 100')) // counted Rs 1000 == expected
    expect(screen.getByText(/Matches/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /confirm & reconcile/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.counts).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.counts[0].difference).toBe(0)
    expect(useAppStore.getState().data!.cashMovements).toHaveLength(0)
  })
})
```

- [ ] **Step 6: Run the page tests**

Run: `npx vitest run CountDrawer`
Expected: PASS (3 tests).

- [ ] **Step 7: Full suite + build + lint**

Run: `npm test`
Expected: PASS.
Run: `npm run build`
Expected: no type errors.
Run: `npm run lint`
Expected: clean (fix any `react-hooks/exhaustive-deps` warnings by depending on the raw slice, not a derived `?? []` array).

- [ ] **Step 8: Commit**

```bash
git add src/pages/CountDrawer.tsx src/pages/CountDrawer.test.tsx src/App.tsx src/pages/Dashboard.tsx src/pages/Cash.tsx
git commit -m "feat(phase4a): count drawer page, route, and wiring"
```

---

## Task 5: Docs + whole-branch review

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`**

In the `## What this is` status line, update the phase status to note Phase 4A complete (Count & Verify). In the `src/domain/` bullet list, add:

```
  - `count.ts` — `Count`, `CountInput`, `applyCount`. Reconciles the drawer to a physical count; logs a `'count'` CashMovement for any difference.
```

In the `cash.ts` bullet, add `diffNotes` to the listed exports. In the `src/data/` bullet, add `counts` to the `AppData` blob field list. In the `src/store/appStore.ts` bullet, add `recordCount` to the actions list. In the `src/pages/` bullet, add `/count` to the route list.

- [ ] **Step 2: Commit docs**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md — Phase 4A count & verify complete"
```

- [ ] **Step 3: Full suite + build gate (final)**

Run: `npm test`
Expected: PASS.
Run: `npm run build`
Expected: no type errors.

- [ ] **Step 4: Whole-branch review**

Dispatch the final code review over all Phase 4A commits (per subagent-driven-development). Focus: golden invariant preserved by `applyCount`; domain purity (no `randomUUID`/`new Date` in `count.ts`); `verbatimModuleSyntax` (`import type` everywhere); back-compat `counts` fill; tests assert resulting `AppData` (drawer, counts, cashMovements), not just rendering.

---

## Self-Review Notes (plan author)

- **Spec coverage:** §3.1 data model → Task 1; §3.2 `applyCount` + `diffNotes` → Tasks 1–2; §3.3 `recordCount` → Task 3; §3.4 page + wiring → Task 4; §4 testing → spread across all tasks; §7 success criteria → covered by domain + store + page tests. ✅
- **Type consistency:** `Count`, `CountInput`, `applyCount`, `diffNotes`, `recordCount` names used identically across tasks. `CashMovement` fields (`id`, `sourceType`, `sourceId`, `delta`, `notes`, `note?`, `createdAt`) match the existing interface used by `applyExpense`. ✅
- **No placeholders:** every code step shows complete code. ✅
- **Known risk:** Task 1 Step 12 — adding `counts` to `AppData` breaks typed `AppData` literals in existing test files until `counts: []` is added. The step names the suspects and instructs the implementer to fix whatever the build flags.
