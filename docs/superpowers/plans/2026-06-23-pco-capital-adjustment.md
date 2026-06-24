# PCO Capital Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the shop owner add or remove their own money (cash note-by-note and/or a wallet) with a full audit trail, without it counting as a customer transaction or profit.

**Architecture:** A new pure domain module `adjustment.ts` mirrors `expense.ts` — `applyAdjustment`/`deleteAdjustment` take `AppData` plus a signed input and return new `AppData`, writing an `'adjustment'` `CashMovement` for any cash change. The store adds two new actions (`addAdjustment`, `deleteAdjustment`) that generate `id`/`createdAt` and call the domain. The UI is a new `/adjustment` page with a direction toggle ("Add money" / "Take money out"), a `NotePicker` for cash, a wallet dropdown + amount field, a live preview, a history list with Delete, and links from the Dashboard and Cash pages.

**Tech Stack:** React 18 + TypeScript 5 + Vite, Zustand v5, React Router v6, Tailwind v3, Vitest + @testing-library/react + jest-dom

## Global Constraints

- **Integer paisa everywhere:** all money stored as `Paisa` (rupees × 100). Use `toPaisa()` on raw number input, `formatPKR()` for display. Paisa literals use underscore style: `3000_00` = Rs 3000.
- **Golden invariant:** `totalCash(drawer) === Σ cashMovements[].delta`. Every drawer change must flow through a `CashMovement` with the exact per-denomination `notes`.
- **Domain purity:** domain functions are pure, immutable, deterministic. Never call `crypto.randomUUID()` or `new Date()` in the domain. `id` and `createdAt` are passed *in* by the store action.
- **`verbatimModuleSyntax` ON:** every type-only import MUST use `import type { … }` (or `import { type X, y }`). Unused imports/vars also fail the build.
- **`applyNoteDelta` throws `Error('NEGATIVE_NOTES')`** if any denomination count goes negative. The UI must catch this.
- **`npm run build` is the type-check gate.** `npm test` does NOT type-check. Always run `npm run build` before declaring a task done.
- **Zustand v5 trap:** selectors returning fresh objects/arrays cause infinite re-renders. Only return primitives or stable references from `useAppStore(...)` selectors. Derive objects/arrays locally or with `useMemo`.
- **Architecture flow:** `domain ← data ← store ← UI`. Lower layers never import upward.
- **`adjustments` never affects `summarize()`.** Adjustments must not appear in customer transaction history, profit, sent, or received totals.
- **`walletDelta` sign convention:** positive = money added to wallet, negative = money removed. Same convention as `applyWalletDelta`.

---

## File Map

| Action  | Path |
|---------|------|
| **Create** | `src/domain/adjustment.ts` |
| **Create** | `src/domain/adjustment.test.ts` |
| **Create** | `src/pages/Adjustment.tsx` |
| **Create** | `src/pages/Adjustment.test.tsx` |
| **Modify** | `src/data/types.ts` |
| **Modify** | `src/data/seed.ts` |
| **Modify** | `src/data/normalize.ts` |
| **Modify** | `src/data/normalize.test.ts` |
| **Modify** | `src/domain/transaction.test.ts` |
| **Modify** | `src/domain/udhar.test.ts` |
| **Modify** | `src/domain/expense.test.ts` |
| **Modify** | `src/domain/count.test.ts` |
| **Modify** | `src/store/appStore.ts` |
| **Modify** | `src/store/appStore.test.ts` |
| **Modify** | `src/App.tsx` |
| **Modify** | `src/pages/Dashboard.tsx` |
| **Modify** | `src/pages/Cash.tsx` |
| **Modify** | `CLAUDE.md` |

---

### Task 1: Data Model Extension + Back-Compat

Introduce the `Adjustment` type, add `adjustments: Adjustment[]` to `AppData`, update seed + normalize, add back-compat test, and fix all existing domain test fixtures so the build stays green.

**Files:**
- Create: `src/domain/adjustment.ts` (types only — functions come in Task 2)
- Modify: `src/data/types.ts`
- Modify: `src/data/seed.ts`
- Modify: `src/data/normalize.ts`
- Modify: `src/data/normalize.test.ts`
- Modify: `src/domain/transaction.test.ts` (fixture)
- Modify: `src/domain/udhar.test.ts` (fixture)
- Modify: `src/domain/expense.test.ts` (fixture)
- Modify: `src/domain/count.test.ts` (fixture)

**Interfaces:**
- Consumes: nothing new
- Produces: `Adjustment`, `AdjustmentInput` types from `src/domain/adjustment.ts`; `AppData.adjustments: Adjustment[]`

- [ ] **Step 1: Create `src/domain/adjustment.ts` with types**

```typescript
import type { Paisa } from './money'

export interface Adjustment {
  id: string
  /** Signed paisa change to the drawer (0 if no cash change). */
  cashDelta: Paisa
  /** Signed per-denomination delta applied to the drawer ({} if no cash change). */
  notes: Record<number, number>
  /** Wallet touched, or null if this adjustment did not touch a wallet. */
  walletId: string | null
  /** Signed paisa change to the wallet (0 if no wallet). */
  walletDelta: Paisa
  note?: string
  createdAt: string
}

export interface AdjustmentInput {
  id: string
  createdAt: string
  /** Signed per-denomination delta. Positive = add notes, negative = remove notes.
   *  Empty or omitted = no cash change. The UI negates counts for "Take money out". */
  cashNotes?: Record<number, number>
  /** Target wallet id; null or omitted = no wallet change. */
  walletId?: string | null
  /** Signed paisa change to the wallet. Positive = add, negative = remove. */
  walletDelta?: Paisa
  note?: string
}
```

- [ ] **Step 2: Update `src/data/types.ts` — add `adjustments`**

Replace the current `types.ts` entirely with:

```typescript
import type { Denomination } from '../domain/denominations'
import type { Wallet } from '../domain/wallet'
import type { DrawerCounts } from '../domain/cash'
import type { Transaction, CashMovement } from '../domain/transaction'
import type { Expense } from '../domain/expense'
import type { Person, UdharEntry } from '../domain/udhar'
import type { Count } from '../domain/count'
import type { Adjustment } from '../domain/adjustment'

export interface Settings {
  shopName: string
  pin: string
  denominations: Denomination[]
  expenseCategories: string[]
}

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
  adjustments: Adjustment[]
}
```

- [ ] **Step 3: Update `src/data/seed.ts` — add `adjustments: []`**

Add `adjustments: [],` at the end of the returned object (after `counts: []`):

```typescript
import type { AppData } from './types'
import { DEFAULT_DENOMINATIONS } from '../domain/denominations'
import { emptyDrawer } from '../domain/cash'
import { DEFAULT_EXPENSE_CATEGORIES } from '../domain/expense'

export function seedData(): AppData {
  return {
    settings: {
      shopName: 'My PCO Shop',
      pin: '1234',
      denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })),
      expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
    },
    wallets: [
      { id: 'easypaisa', name: 'Easypaisa', balance: 0 },
      { id: 'jazzcash', name: 'JazzCash', balance: 0 },
      { id: 'bank', name: 'Bank', balance: 0 },
    ],
    drawer: emptyDrawer(DEFAULT_DENOMINATIONS),
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}
```

- [ ] **Step 4: Update `src/data/normalize.ts` — back-fill `adjustments`**

Add `adjustments: data.adjustments ?? [],` (after `counts`):

```typescript
import type { AppData } from './types'
import { DEFAULT_EXPENSE_CATEGORIES } from '../domain/expense'

/** Fill in fields that old persisted data may lack (back-compat). */
export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    settings: {
      ...data.settings,
      expenseCategories: data.settings.expenseCategories ?? [...DEFAULT_EXPENSE_CATEGORIES],
    },
    transactions: data.transactions ?? [],
    cashMovements: data.cashMovements ?? [],
    persons: data.persons ?? [],
    udharEntries: data.udharEntries ?? [],
    expenses: data.expenses ?? [],
    counts: data.counts ?? [],
    adjustments: data.adjustments ?? [],
  }
}
```

- [ ] **Step 5: Write the failing back-compat test in `src/data/normalize.test.ts`**

Append inside the existing `describe('normalizeAppData', ...)` block:

```typescript
  it('back-fills adjustments for old data', () => {
    const old = {
      settings: { shopName: 'X', pin: '1234', denominations: [], expenseCategories: [] },
      wallets: [],
      drawer: {},
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const n = normalizeAppData(old)
    expect(n.adjustments).toEqual([])
  })
```

- [ ] **Step 6: Run the new test — confirm it fails before the fix**

```bash
npx vitest run normalize --reporter=verbose
```

Expected: FAIL — `Cannot read properties of undefined` or type error (adjustments not yet in normalize).

- [ ] **Step 7: (Already done in Step 4) — run normalize tests again to confirm pass**

```bash
npx vitest run normalize --reporter=verbose
```

Expected: all normalize tests PASS.

- [ ] **Step 8: Add `adjustments: []` to all four domain test fixtures**

**`src/domain/transaction.test.ts`** — in `baseData()`, add `adjustments: [],` after `counts: []`:

```typescript
function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: [] },
    wallets: [{ id: 'jazzcash', name: 'JazzCash', balance: 100000_00 }],
    drawer: emptyDrawer(DEFAULT_DENOMINATIONS),
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}
```

**`src/domain/udhar.test.ts`** — in `baseData()`, add `adjustments: [],` after `counts: []`:

```typescript
function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: [] },
    wallets: [{ id: 'easypaisa', name: 'Easypaisa', balance: 5000_00 }],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 1000: 5 },
    transactions: [],
    cashMovements: [],
    persons: [{ id: 'p1', name: 'Ali' }],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}
```

**`src/domain/expense.test.ts`** — in `baseData()`, add `adjustments: [],` after `counts: []`:

```typescript
function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: ['Bijli'] },
    wallets: [{ id: 'easypaisa', name: 'Easypaisa', balance: 5000_00 }],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 100: 10 },
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}
```

**`src/domain/count.test.ts`** — in `baseData()`, add `adjustments: [],` after `counts: []`:

```typescript
function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: [] },
    wallets: [],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 1000: 5, 100: 8 },
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}
```

- [ ] **Step 9: Run the full test suite**

```bash
npm test
```

Expected: all existing tests PASS (fixture additions are additive).

- [ ] **Step 10: Run the build**

```bash
npm run build
```

Expected: BUILD SUCCEEDS — no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add src/domain/adjustment.ts src/data/types.ts src/data/seed.ts src/data/normalize.ts src/data/normalize.test.ts src/domain/transaction.test.ts src/domain/udhar.test.ts src/domain/expense.test.ts src/domain/count.test.ts
git commit -m "feat: add Adjustment type + AppData.adjustments, back-fill normalize"
```

---

### Task 2: Domain — `applyAdjustment` + `deleteAdjustment`

Implement the two pure domain functions in `adjustment.ts` using TDD. The type definitions were established in Task 1.

**Files:**
- Create: `src/domain/adjustment.test.ts`
- Modify: `src/domain/adjustment.ts` (add imports + two functions)

**Interfaces:**
- Consumes: `Adjustment`, `AdjustmentInput` from Task 1; `applyNoteDelta`, `totalCash`, `negateNotes` from `src/domain/cash.ts`; `applyWalletDelta` from `src/domain/wallet.ts`; `CashMovement` from `src/domain/transaction.ts`; `AppData` from `src/data/types.ts`
- Produces:
  - `applyAdjustment(data: AppData, input: AdjustmentInput): AppData` — pure, throws `Error('NEGATIVE_NOTES')` if cash removal exceeds the drawer
  - `deleteAdjustment(data: AppData, adjustmentId: string): AppData` — returns `data` unchanged if `adjustmentId` not found

- [ ] **Step 1: Write `src/domain/adjustment.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import { applyAdjustment, deleteAdjustment, type AdjustmentInput } from './adjustment'

function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: [] },
    wallets: [{ id: 'easypaisa', name: 'Easypaisa', balance: 5000_00 }],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 1000: 5, 100: 8 }, // Rs 5800
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}

function inp(over: Partial<AdjustmentInput> = {}): AdjustmentInput {
  return { id: 'adj1', createdAt: '2026-06-23T10:00:00.000Z', ...over }
}

describe('applyAdjustment — cash only', () => {
  it('adds notes to drawer, logs a positive adjustment movement, records snapshot', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ cashNotes: { 1000: 2 } }))
    expect(next.drawer[1000]).toBe(7)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].sourceType).toBe('adjustment')
    expect(next.cashMovements[0].sourceId).toBe('adj1')
    expect(next.cashMovements[0].delta).toBe(2000_00)
    expect(next.cashMovements[0].notes).toEqual({ 1000: 2 })
    expect(next.adjustments).toHaveLength(1)
    expect(next.adjustments[0].id).toBe('adj1')
    expect(next.adjustments[0].cashDelta).toBe(2000_00)
    expect(next.adjustments[0].walletId).toBeNull()
    expect(next.adjustments[0].walletDelta).toBe(0)
    expect(next.wallets[0].balance).toBe(5000_00) // wallet untouched
  })

  it('removes notes from drawer with negative cashNotes, logs negative delta', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ cashNotes: { 1000: -3 } }))
    expect(next.drawer[1000]).toBe(2)
    expect(next.cashMovements[0].delta).toBe(-3000_00)
    expect(next.adjustments[0].cashDelta).toBe(-3000_00)
  })

  it('throws NEGATIVE_NOTES when removing more notes than the drawer holds', () => {
    expect(() => applyAdjustment(baseData(), inp({ cashNotes: { 1000: -6 } }))).toThrow('NEGATIVE_NOTES')
  })

  it('golden invariant holds after adding cash', () => {
    const start = baseData()
    const next = applyAdjustment(start, inp({ cashNotes: { 500: 4 } }))
    const movementSum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(next.drawer)).toBe(totalCash(start.drawer) + movementSum)
  })

  it('golden invariant holds after removing cash', () => {
    const start = baseData()
    const next = applyAdjustment(start, inp({ cashNotes: { 100: -3 } }))
    const movementSum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(next.drawer)).toBe(totalCash(start.drawer) + movementSum)
  })
})

describe('applyAdjustment — wallet only', () => {
  it('increases wallet balance, no CashMovement, snapshot records walletId and walletDelta', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ walletId: 'easypaisa', walletDelta: 3000_00 }))
    expect(next.wallets[0].balance).toBe(8000_00)
    expect(next.cashMovements).toHaveLength(0)
    expect(next.adjustments[0].walletId).toBe('easypaisa')
    expect(next.adjustments[0].walletDelta).toBe(3000_00)
    expect(next.adjustments[0].cashDelta).toBe(0)
    expect(next.adjustments[0].notes).toEqual({})
    expect(next.drawer).toEqual(data.drawer)
  })

  it('decreases wallet balance with negative walletDelta', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ walletId: 'easypaisa', walletDelta: -2000_00 }))
    expect(next.wallets[0].balance).toBe(3000_00)
    expect(next.adjustments[0].walletDelta).toBe(-2000_00)
  })
})

describe('applyAdjustment — cash + wallet', () => {
  it('moves both cash and wallet, one movement and one snapshot', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ cashNotes: { 500: 2 }, walletId: 'easypaisa', walletDelta: 1000_00 }))
    expect(next.drawer[500]).toBe(2)
    expect(next.wallets[0].balance).toBe(6000_00)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].delta).toBe(1000_00)
    expect(next.adjustments[0].cashDelta).toBe(1000_00)
    expect(next.adjustments[0].walletDelta).toBe(1000_00)
    expect(next.adjustments[0].walletId).toBe('easypaisa')
  })
})

describe('applyAdjustment — no-op (nothing specified)', () => {
  it('still records a snapshot with zero deltas, no CashMovement', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp())
    expect(next.adjustments).toHaveLength(1)
    expect(next.adjustments[0].cashDelta).toBe(0)
    expect(next.adjustments[0].walletDelta).toBe(0)
    expect(next.cashMovements).toHaveLength(0)
    expect(next.drawer).toEqual(data.drawer)
    expect(next.wallets[0].balance).toBe(5000_00)
  })
})

describe('applyAdjustment — immutability', () => {
  it('does not mutate the input data', () => {
    const data = baseData()
    applyAdjustment(data, inp({ cashNotes: { 1000: 1 } }))
    expect(data.drawer[1000]).toBe(5)
    expect(data.adjustments).toHaveLength(0)
    expect(data.cashMovements).toHaveLength(0)
  })

  it('does not touch transactions, expenses, or persons', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ cashNotes: { 1000: 1 } }))
    expect(next.transactions).toBe(data.transactions)
    expect(next.expenses).toBe(data.expenses)
    expect(next.persons).toBe(data.persons)
  })
})

describe('deleteAdjustment', () => {
  it('reverses a cash adjustment: drawer restored, movement dropped, record removed', () => {
    const after = applyAdjustment(baseData(), inp({ cashNotes: { 1000: 2 }, id: 'adj1' }))
    const reverted = deleteAdjustment(after, 'adj1')
    expect(reverted.drawer[1000]).toBe(5)
    expect(reverted.cashMovements).toHaveLength(0)
    expect(reverted.adjustments).toHaveLength(0)
  })

  it('reverses a wallet adjustment: balance restored, record removed', () => {
    const after = applyAdjustment(baseData(), inp({ walletId: 'easypaisa', walletDelta: 3000_00, id: 'adj1' }))
    const reverted = deleteAdjustment(after, 'adj1')
    expect(reverted.wallets[0].balance).toBe(5000_00)
    expect(reverted.adjustments).toHaveLength(0)
  })

  it('reverses both cash and wallet in one adjustment', () => {
    const after = applyAdjustment(baseData(), inp({
      cashNotes: { 100: -3 },    // remove 3 × Rs100 (drawer had 8, leaves 5)
      walletId: 'easypaisa',
      walletDelta: -2000_00,      // remove Rs 2000 from wallet (had 5000, leaves 3000)
      id: 'adj1',
    }))
    expect(after.drawer[100]).toBe(5)
    expect(after.wallets[0].balance).toBe(3000_00)

    const reverted = deleteAdjustment(after, 'adj1')
    expect(reverted.drawer[100]).toBe(8)
    expect(reverted.wallets[0].balance).toBe(5000_00)
    expect(reverted.adjustments).toHaveLength(0)
    expect(reverted.cashMovements).toHaveLength(0)
  })

  it('returns data unchanged for an unknown id', () => {
    const after = applyAdjustment(baseData(), inp({ cashNotes: { 1000: 1 } }))
    const result = deleteAdjustment(after, 'nope')
    expect(result.adjustments).toHaveLength(1)
    expect(result.cashMovements).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test file — confirm all tests fail**

```bash
npx vitest run adjustment --reporter=verbose
```

Expected: FAIL — `applyAdjustment is not a function` (functions not yet implemented).

- [ ] **Step 3: Implement `applyAdjustment` and `deleteAdjustment` in `src/domain/adjustment.ts`**

Replace the file content completely:

```typescript
import type { Paisa } from './money'
import type { AppData } from '../data/types'
import type { CashMovement } from './transaction'
import { applyNoteDelta, totalCash, negateNotes } from './cash'
import { applyWalletDelta } from './wallet'

export interface Adjustment {
  id: string
  cashDelta: Paisa
  notes: Record<number, number>
  walletId: string | null
  walletDelta: Paisa
  note?: string
  createdAt: string
}

export interface AdjustmentInput {
  id: string
  createdAt: string
  cashNotes?: Record<number, number>
  walletId?: string | null
  walletDelta?: Paisa
  note?: string
}

/** Apply a capital adjustment. Pure/immutable. Throws Error('NEGATIVE_NOTES') if cash removal exceeds the drawer. */
export function applyAdjustment(data: AppData, input: AdjustmentInput): AppData {
  const cashNotes = input.cashNotes ?? {}
  const walletDelta = input.walletDelta ?? 0
  const walletId = input.walletId ?? null

  const hasCash = Object.values(cashNotes).some((n) => n !== 0)
  const hasWallet = walletId !== null && walletDelta !== 0

  // Cash part — applyNoteDelta may throw NEGATIVE_NOTES
  const drawer = hasCash ? applyNoteDelta(data.drawer, cashNotes) : data.drawer
  const cashDelta: Paisa = hasCash ? totalCash(cashNotes) : 0

  const newMovement: CashMovement | null = hasCash
    ? {
        id: `${input.id}-c`,
        sourceType: 'adjustment',
        sourceId: input.id,
        delta: cashDelta,
        notes: cashNotes,
        note: input.note,
        createdAt: input.createdAt,
      }
    : null

  // Wallet part
  const wallets = hasWallet
    ? data.wallets.map((w) => (w.id === walletId ? applyWalletDelta(w, walletDelta) : w))
    : data.wallets

  // Snapshot
  const adjustment: Adjustment = {
    id: input.id,
    cashDelta,
    notes: hasCash ? cashNotes : {},
    walletId: hasWallet ? walletId : null,
    walletDelta: hasWallet ? walletDelta : 0,
    note: input.note,
    createdAt: input.createdAt,
  }

  return {
    ...data,
    drawer,
    wallets,
    cashMovements: newMovement ? [newMovement, ...data.cashMovements] : data.cashMovements,
    adjustments: [adjustment, ...data.adjustments],
  }
}

/** Remove a capital adjustment and fully reverse its effect. Returns data unchanged if not found. */
export function deleteAdjustment(data: AppData, adjustmentId: string): AppData {
  const adjustment = data.adjustments.find((a) => a.id === adjustmentId)
  if (!adjustment) return data

  // Reverse cash
  let drawer = data.drawer
  let cashMovements = data.cashMovements
  if (adjustment.cashDelta !== 0) {
    const movement = data.cashMovements.find((m) => m.sourceId === adjustmentId)
    if (movement) {
      drawer = applyNoteDelta(data.drawer, negateNotes(movement.notes))
      cashMovements = data.cashMovements.filter((m) => m.sourceId !== adjustmentId)
    }
  }

  // Reverse wallet
  const wallets =
    adjustment.walletId !== null && adjustment.walletDelta !== 0
      ? data.wallets.map((w) =>
          w.id === adjustment.walletId ? applyWalletDelta(w, -adjustment.walletDelta) : w,
        )
      : data.wallets

  return {
    ...data,
    drawer,
    wallets,
    cashMovements,
    adjustments: data.adjustments.filter((a) => a.id !== adjustmentId),
  }
}
```

- [ ] **Step 4: Run the adjustment tests — all must pass**

```bash
npx vitest run adjustment --reporter=verbose
```

Expected: all adjustment tests PASS.

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Run the build**

```bash
npm run build
```

Expected: BUILD SUCCEEDS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/adjustment.ts src/domain/adjustment.test.ts
git commit -m "feat: implement applyAdjustment and deleteAdjustment domain functions"
```

---

### Task 3: Store Actions

Add `addAdjustment` and `deleteAdjustment` to the Zustand store, following the exact same pattern as the existing `addExpense`/`deleteExpense` actions.

**Files:**
- Modify: `src/store/appStore.ts`
- Modify: `src/store/appStore.test.ts`

**Interfaces:**
- Consumes:
  - `applyAdjustment(data: AppData, input: AdjustmentInput): AppData` from Task 2
  - `deleteAdjustment(data: AppData, adjustmentId: string): AppData` from Task 2
- Produces:
  - `addAdjustment(input: Omit<AdjustmentInput, 'id' | 'createdAt'>): Promise<void>` on the store
  - `deleteAdjustment(id: string): Promise<void>` on the store

- [ ] **Step 1: Write the failing store tests — append to `src/store/appStore.test.ts`**

Add a new `describe` block at the end of the file:

```typescript
describe('appStore adjustments', () => {
  it('addAdjustment (cash) raises drawer, logs adjustment movement, persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } })

    await useAppStore.getState().addAdjustment({ cashNotes: { 1000: 2 } })

    const data = useAppStore.getState().data!
    expect(data.adjustments).toHaveLength(1)
    expect(data.adjustments[0].id).toBeTruthy()
    expect(data.drawer[1000]).toBe(7)
    expect(data.cashMovements).toHaveLength(1)
    expect(data.cashMovements[0].sourceType).toBe('adjustment')
    expect(data.cashMovements[0].delta).toBe(2000_00)
    const reloaded = await repo.load()
    expect(reloaded.adjustments).toHaveLength(1)
  })

  it('addAdjustment (wallet) raises wallet balance, no CashMovement, persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)

    await useAppStore.getState().addAdjustment({ walletId: 'easypaisa', walletDelta: 5000_00 })

    const data = useAppStore.getState().data!
    expect(data.adjustments).toHaveLength(1)
    expect(data.wallets.find((w) => w.id === 'easypaisa')!.balance).toBe(5000_00)
    expect(data.cashMovements).toHaveLength(0)
    const reloaded = await repo.load()
    expect(reloaded.adjustments).toHaveLength(1)
  })

  it('deleteAdjustment reverses effects and persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } })

    await useAppStore.getState().addAdjustment({ cashNotes: { 1000: 2 } })
    const id = useAppStore.getState().data!.adjustments[0].id
    await useAppStore.getState().deleteAdjustment(id)

    const data = useAppStore.getState().data!
    expect(data.adjustments).toHaveLength(0)
    expect(data.drawer[1000]).toBe(5)
    expect(data.cashMovements).toHaveLength(0)
    const reloaded = await repo.load()
    expect(reloaded.adjustments).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the new tests — confirm they fail**

```bash
npx vitest run appStore --reporter=verbose
```

Expected: FAIL — `addAdjustment is not a function`.

- [ ] **Step 3: Update `src/store/appStore.ts` — add imports**

Add these two lines after the existing `import { applyCount } from '../domain/count'` and `import type { CountInput } from '../domain/count'` lines:

```typescript
import { applyAdjustment, deleteAdjustment as deleteAdjustmentDomain } from '../domain/adjustment'
import type { AdjustmentInput } from '../domain/adjustment'
```

- [ ] **Step 4: Add two entries to the `AppState` interface** (after `recordCount: ...`):

```typescript
  addAdjustment: (input: Omit<AdjustmentInput, 'id' | 'createdAt'>) => Promise<void>
  deleteAdjustment: (id: string) => Promise<void>
```

- [ ] **Step 5: Add two action implementations** inside the `create<AppState>((set, get) => ({...}))` object, after the `recordCount` implementation:

```typescript
  async addAdjustment(input) {
    const { repo, data } = get()
    if (!repo || !data) return
    const full: AdjustmentInput = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    const next = applyAdjustment(data, full)
    await repo.save(next)
    set({ data: next })
  },

  async deleteAdjustment(id) {
    const { repo, data } = get()
    if (!repo || !data) return
    const next = deleteAdjustmentDomain(data, id)
    await repo.save(next)
    set({ data: next })
  },
```

- [ ] **Step 6: Run the store tests — all must pass**

```bash
npx vitest run appStore --reporter=verbose
```

Expected: all store tests PASS.

- [ ] **Step 7: Run the full suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 8: Run the build**

```bash
npm run build
```

Expected: BUILD SUCCEEDS.

- [ ] **Step 9: Commit**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts
git commit -m "feat: add addAdjustment and deleteAdjustment store actions"
```

---

### Task 4: UI Page + Wiring + CLAUDE.md

Create the `Adjustment.tsx` page, register the `/adjustment` route, add quick-action links from Dashboard and Cash, write page tests, and update `CLAUDE.md`.

**Files:**
- Create: `src/pages/Adjustment.tsx`
- Create: `src/pages/Adjustment.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Cash.tsx`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes:
  - `addAdjustment(input: Omit<AdjustmentInput, 'id' | 'createdAt'>): Promise<void>` from Task 3
  - `deleteAdjustment(id: string): Promise<void>` from Task 3
  - `NotePicker` (props: `label: string`, `denominations: Denomination[]`, `counts: Record<number,number>`, `onChange: (c: Record<number,number>) => void`)
  - `toPaisa`, `formatPKR` from `src/domain/money.ts`
  - `totalCash` from `src/domain/cash.ts`
- Produces: `/adjustment` route accessible from Dashboard and Cash page

- [ ] **Step 1: Write `src/pages/Adjustment.test.tsx`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import Adjustment from './Adjustment'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({
    data: {
      ...useAppStore.getState().data!,
      drawer: { 1000: 5 }, // Rs 5000
      wallets: [
        { id: 'easypaisa', name: 'Easypaisa', balance: 3000_00 },
        { id: 'jazzcash', name: 'JazzCash', balance: 0 },
        { id: 'bank', name: 'Bank', balance: 0 },
      ],
    },
  })
})

function renderPage() {
  return render(
    <MemoryRouter>
      <Adjustment />
    </MemoryRouter>,
  )
}

describe('Adjustment page', () => {
  it('Confirm is disabled when nothing is entered', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('adds cash to the drawer and records an adjustment movement', async () => {
    renderPage()
    fireEvent.click(screen.getByLabelText('add Rs 1000'))
    fireEvent.click(screen.getByLabelText('add Rs 1000'))
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.adjustments).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.drawer[1000]).toBe(7)
    expect(useAppStore.getState().data!.cashMovements[0].sourceType).toBe('adjustment')
    expect(useAppStore.getState().data!.cashMovements[0].delta).toBe(2000_00)
  })

  it('"Take money out" direction negates the cash change', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /take money out/i }))
    fireEvent.click(screen.getByLabelText('add Rs 1000'))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.adjustments).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.drawer[1000]).toBe(4) // 5 - 1 = 4
    expect(useAppStore.getState().data!.cashMovements[0].delta).toBe(-1000_00)
  })

  it('Confirm is disabled when removing more from a wallet than it holds', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /take money out/i }))
    fireEvent.change(screen.getByRole('combobox', { name: /wallet/i }), { target: { value: 'easypaisa' } })
    // walletAmount input appears now; Rs 40000 > Easypaisa balance of Rs 3000
    fireEvent.change(screen.getByLabelText(/amount \(rs\)/i), { target: { value: '40000' } })
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('Delete button removes an adjustment and reverses the drawer', async () => {
    // Pre-add via store so history shows without navigating
    await useAppStore.getState().addAdjustment({ cashNotes: { 1000: 2 } }) // drawer: 5+2=7
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.adjustments).toHaveLength(0)
    })
    expect(useAppStore.getState().data!.drawer[1000]).toBe(5) // reversed
    expect(useAppStore.getState().data!.cashMovements).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test — confirm it fails (component doesn't exist yet)**

```bash
npx vitest run Adjustment --reporter=verbose
```

Expected: FAIL — `Cannot find module './Adjustment'`.

- [ ] **Step 3: Create `src/pages/Adjustment.tsx`**

```typescript
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { toPaisa, formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import NotePicker from '../components/NotePicker'

type Direction = 'add' | 'remove'

export default function Adjustment() {
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const addAdjustment = useAppStore((s) => s.addAdjustment)
  const deleteAdjustment = useAppStore((s) => s.deleteAdjustment)

  const [direction, setDirection] = useState<Direction>('add')
  const [cashNotes, setCashNotes] = useState<Record<number, number>>({})
  const [walletId, setWalletId] = useState<string | null>(null)
  const [walletAmount, setWalletAmount] = useState<number>(0)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derive from data before the early-return guard (hooks must be unconditional)
  const denominations = data?.settings.denominations ?? []
  const wallets = data?.wallets ?? []
  const drawer = data?.drawer ?? {}
  const adjustments = data?.adjustments ?? []

  const hasCashNotes = useMemo(() => Object.values(cashNotes).some((n) => n > 0), [cashNotes])
  const cashNotesTotal = useMemo(() => totalCash(cashNotes), [cashNotes])

  if (!data) return <div className="p-8">Loading…</div>

  const walletAmountPaisa = toPaisa(walletAmount)
  const hasWallet = walletId !== null && walletAmountPaisa > 0
  const sign = direction === 'add' ? 1 : -1
  const newCashTotal = totalCash(drawer) + sign * cashNotesTotal
  const selectedWallet = wallets.find((w) => w.id === walletId)
  const newWalletBalance = selectedWallet ? selectedWallet.balance + sign * walletAmountPaisa : null
  const walletWouldGoNegative =
    direction === 'remove' && hasWallet && newWalletBalance !== null && newWalletBalance < 0
  const canSubmit = !loading && (hasCashNotes || hasWallet) && !walletWouldGoNegative

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const effectNotes: Record<number, number> = {}
      for (const [d, count] of Object.entries(cashNotes)) {
        if (count > 0) effectNotes[Number(d)] = sign * count
      }
      await addAdjustment({
        cashNotes: hasCashNotes ? effectNotes : undefined,
        walletId: hasWallet ? walletId : null,
        walletDelta: hasWallet ? sign * walletAmountPaisa : undefined,
        note: note.trim() || undefined,
      })
      navigate('/')
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'NEGATIVE_NOTES'
          ? "Drawer doesn't have those notes. Reduce the amount and try again."
          : 'Could not save. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Add / Remove Money</h1>
        <p className="text-sm text-slate-500">Adjust your own cash or wallet balance.</p>
      </header>

      <div className="flex gap-2 rounded-xl border bg-white p-3">
        {(['add', 'remove'] as Direction[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
              direction === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {d === 'add' ? 'Add money' : 'Take money out'}
          </button>
        ))}
      </div>

      <NotePicker
        label={direction === 'add' ? 'Notes to Add' : 'Notes to Remove'}
        denominations={denominations}
        counts={cashNotes}
        onChange={setCashNotes}
      />

      {wallets.length > 0 && (
        <div className="space-y-2 rounded-xl border bg-white p-3">
          <label htmlFor="wallet-select" className="block text-sm font-semibold text-slate-600">
            Wallet (optional)
          </label>
          <select
            id="wallet-select"
            aria-label="Wallet"
            value={walletId ?? ''}
            onChange={(e) => {
              setWalletId(e.target.value || null)
              setWalletAmount(0)
            }}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="">— No wallet —</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({formatPKR(w.balance)})
              </option>
            ))}
          </select>
          {walletId && (
            <div>
              <label htmlFor="walletAmount" className="mb-1 block text-xs font-semibold text-slate-600">
                Amount (Rs)
              </label>
              <input
                id="walletAmount"
                type="number"
                value={walletAmount}
                onChange={(e) => setWalletAmount(Number(e.target.value))}
                className="w-full rounded-lg border px-3 py-2"
                min="0"
                step="0.01"
              />
              {walletWouldGoNegative && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  Amount exceeds wallet balance ({formatPKR(selectedWallet!.balance)}).
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-white p-3">
        <label htmlFor="adj-note" className="mb-2 block text-sm font-semibold text-slate-600">
          Reason (optional)
        </label>
        <input
          id="adj-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          placeholder="e.g., added savings, withdrew for house expense"
        />
      </div>

      {(hasCashNotes || hasWallet) && (
        <section className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-slate-500">Preview</p>
          {hasCashNotes && (
            <div className="flex justify-between">
              <span>New cash total</span>
              <span className="font-semibold">{formatPKR(newCashTotal)}</span>
            </div>
          )}
          {hasWallet && newWalletBalance !== null && (
            <div className="flex justify-between">
              <span>{selectedWallet?.name} balance</span>
              <span className={`font-semibold ${newWalletBalance < 0 ? 'text-red-600' : ''}`}>
                {formatPKR(newWalletBalance)}
              </span>
            </div>
          )}
        </section>
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
          className={`rounded-xl py-3 font-semibold text-white ${
            canSubmit ? 'bg-emerald-600 hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-400'
          }`}
        >
          {loading ? 'Saving…' : 'Confirm'}
        </button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">History</h2>
        {adjustments.length === 0 && <p className="text-sm text-slate-500">No adjustments yet.</p>}
        <ul className="space-y-1">
          {adjustments.slice(0, 20).map((a) => {
            const wallet = wallets.find((w) => w.id === a.walletId)
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm"
              >
                <span className="shrink-0 text-slate-400">
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
                <span className="min-w-0 flex-1">
                  {a.cashDelta !== 0 && (
                    <span className={`mr-2 ${a.cashDelta > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      Cash {a.cashDelta > 0 ? '+' : ''}
                      {formatPKR(a.cashDelta)}
                    </span>
                  )}
                  {wallet && a.walletDelta !== 0 && (
                    <span className={a.walletDelta > 0 ? 'text-emerald-700' : 'text-red-600'}>
                      {wallet.name} {a.walletDelta > 0 ? '+' : ''}
                      {formatPKR(a.walletDelta)}
                    </span>
                  )}
                  {a.note && <span className="ml-1 text-slate-400">"{a.note}"</span>}
                </span>
                <button
                  type="button"
                  onClick={() => deleteAdjustment(a.id)}
                  className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600"
                >
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run the page tests — all must pass**

```bash
npx vitest run Adjustment --reporter=verbose
```

Expected: all 5 Adjustment page tests PASS.

- [ ] **Step 5: Register the `/adjustment` route in `src/App.tsx`**

Add the import and route. Full file after edit:

```typescript
import { Routes, Route } from 'react-router-dom'
import { useAppStore } from './store/appStore'
import Login from './pages/Login'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import NewTransaction from './pages/NewTransaction'
import Transactions from './pages/Transactions'
import Cash from './pages/Cash'
import Settings from './pages/Settings'
import Kharcha from './pages/Kharcha'
import Udhari from './pages/Udhari'
import PersonDetail from './pages/PersonDetail'
import CountDrawer from './pages/CountDrawer'
import Adjustment from './pages/Adjustment'

export default function App() {
  const authed = useAppStore((s) => s.authed)
  const data = useAppStore((s) => s.data)

  if (!data) return <div className="p-8 text-center">Loading…</div>
  if (!authed) return <Login />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewTransaction />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="cash" element={<Cash />} />
        <Route path="settings" element={<Settings />} />
        <Route path="kharcha" element={<Kharcha />} />
        <Route path="udhari" element={<Udhari />} />
        <Route path="udhari/:personId" element={<PersonDetail />} />
        <Route path="count" element={<CountDrawer />} />
        <Route path="adjustment" element={<Adjustment />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 6: Add "Add / Remove Money" quick-action link in `src/pages/Dashboard.tsx`**

Replace the existing quick-action `<section>` (the `<section className="grid grid-cols-2 gap-2">` block) with:

```typescript
      <section className="grid grid-cols-2 gap-2">
        <Link to="/new" className="col-span-2 rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white">
          + New Transaction
        </Link>
        <Link to="/kharcha" className="rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
          Kharcha
        </Link>
        <Link to="/udhari" className="rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
          Udhar
        </Link>
        <Link to="/count" className="rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
          Count Drawer
        </Link>
        <Link to="/adjustment" className="rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
          Add / Remove Money
        </Link>
        <Link to="/cash" className="rounded-xl bg-slate-200 py-3 text-center font-semibold">
          Cash &amp; Notes
        </Link>
        <Link to="/transactions" className="rounded-xl bg-slate-200 py-3 text-center font-semibold">
          Transactions
        </Link>
      </section>
```

- [ ] **Step 7: Add "Add / Remove Money" link in `src/pages/Cash.tsx`**

Add a second link button directly below the existing "Count & Verify" link (before the stats section):

```typescript
      <Link to="/count" className="block rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white">
        Count &amp; Verify
      </Link>

      <Link to="/adjustment" className="block rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
        Add / Remove Money
      </Link>
```

- [ ] **Step 8: Update `CLAUDE.md` with 5 surgical edits**

**Edit 1 — Status line.** Replace:
```
Status: Phases 1, 2A, 2B, 3, and 4A are complete on `main`.
```
With:
```
Status: Phases 1, 2A, 2B, 3, 4A, and Capital Adjustment are complete on `main`.
```

**Edit 2 — Add `adjustment.ts` to domain bullet list**, after the `count.ts` bullet:
```
  - `adjustment.ts` — `Adjustment`, `AdjustmentInput`, `applyAdjustment`, `deleteAdjustment`. Owner capital add/remove: adjusts the cash drawer (signed note-by-note delta) and/or a wallet, writes a `'adjustment'` `CashMovement` (golden invariant preserved), records an `Adjustment` snapshot. Reversible via `deleteAdjustment` (mirrors `deleteExpense`). Never touches `transactions` or `summarize()` — zero profit impact.
```

**Edit 3 — AppData field list** (in the `src/data/` paragraph). After `counts: Count[]`, add:
```
`adjustments: Adjustment[]`
```

**Edit 4 — Store actions paragraph.** After the sentence mentioning `recordCount`, add:
```
Capital Adjustment adds: `addAdjustment`, `deleteAdjustment`.
```

**Edit 5 — Routes list** (in `src/pages/` paragraph). After `/count`, add:
```
`/adjustment`
```

- [ ] **Step 9: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 10: Run the build**

```bash
npm run build
```

Expected: BUILD SUCCEEDS — no TypeScript or Vite errors.

- [ ] **Step 11: Commit**

```bash
git add src/pages/Adjustment.tsx src/pages/Adjustment.test.tsx src/App.tsx src/pages/Dashboard.tsx src/pages/Cash.tsx CLAUDE.md
git commit -m "feat: add Adjustment page, route, dashboard and cash wiring"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| `Adjustment` entity with signed `cashDelta`, `notes`, `walletId`, `walletDelta` | Task 1 + 2 |
| `AdjustmentInput` with signed `cashNotes`, `walletId`, `walletDelta` | Task 1 + 2 |
| `applyAdjustment` — cash part uses `applyNoteDelta`, throws `NEGATIVE_NOTES` | Task 2 |
| `applyAdjustment` — wallet part uses `applyWalletDelta` | Task 2 |
| `applyAdjustment` — always prepends `Adjustment` snapshot | Task 2 |
| `deleteAdjustment` — reverses via `negateNotes` + `-walletDelta` | Task 2 |
| Store: `addAdjustment` generates `id`/`createdAt`, persists | Task 3 |
| Store: `deleteAdjustment` reverses and persists | Task 3 |
| `AppData.adjustments: Adjustment[]` — seeded + back-filled in normalize | Task 1 |
| Page: direction toggle (Add money / Take money out) | Task 4 |
| Page: `NotePicker` for cash | Task 4 |
| Page: wallet dropdown + amount field | Task 4 |
| Page: Reason input (optional) | Task 4 |
| Page: live preview (new cash total + new wallet balance) | Task 4 |
| Page: Confirm disabled when nothing entered | Task 4 |
| Page: Confirm disabled when wallet would go negative | Task 4 |
| Page: `NEGATIVE_NOTES` → "Drawer doesn't have those notes" | Task 4 |
| Page: Confirm → `addAdjustment` → navigate to `/` | Task 4 |
| Page: history list with Delete button | Task 4 |
| `/adjustment` route in `App.tsx` | Task 4 |
| Dashboard "Add / Remove Money" link | Task 4 |
| Cash page "Add / Remove Money" link | Task 4 |
| `CLAUDE.md` updated | Task 4 |
| Domain tests: golden invariant, immutability, no-transaction-touch | Task 2 |
| Store tests: persist through repo | Task 3 |
| Back-compat: old data gets `adjustments: []` | Task 1 |
| Page tests: add-cash, take-out, wallet-negative-disabled, delete | Task 4 |

All spec requirements covered.

### Placeholder scan

No TBDs, no "implement later", no vague requirements. All steps contain the actual code to write.

### Type consistency

- `Adjustment` defined in Task 1 as an interface with `cashDelta: Paisa`, `notes: Record<number,number>`, `walletId: string | null`, `walletDelta: Paisa`. Used identically throughout Tasks 2, 3, 4. ✓
- `AdjustmentInput` defined in Task 1 with optional `cashNotes`, `walletId`, `walletDelta`. Consumed identically in Tasks 2 (domain), 3 (store), 4 (page call). ✓
- `applyAdjustment(data: AppData, input: AdjustmentInput): AppData` — exact signature used in Task 2 (implementation), Task 3 (store call). ✓
- `deleteAdjustment` (domain, 2 args) aliased as `deleteAdjustmentDomain` in Task 3 to avoid clash with store action of same name. ✓
- `cashNotes` (signed deltas, `Record<number,number>`) — consistent across Task 1 (type), Task 2 (impl), Task 3 (store test), Task 4 (page). ✓
- `walletDelta` is signed paisa (`Paisa`) throughout — positive = add, negative = remove. ✓
