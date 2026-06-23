# PCO Phase 3 — Kharcha + Udhari Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expense tracking (Kharcha) and a per-person credit ledger (Udhari) to the PCO cash app, each settling against either the cash drawer or a digital wallet, while preserving the golden cash invariant.

**Architecture:** Two new domain modules (`expense.ts`, `udhar.ts`) follow the exact shape of the existing `transaction.ts`: pure, immutable functions that take an `AppData` plus an input record and return new `AppData`, generating a `CashMovement` for every cash settlement. Both reuse the drawer/wallet primitives (`applyNoteDelta`, `applyWalletDelta`) so the invariant `totalCash(drawer) === Σ cashMovements[].delta` continues to hold by construction. Money source is `'cash' | 'wallet'`: cash settlements move the drawer + log a movement; wallet settlements move a wallet balance and log **no** cash movement. The data layer extends the single `AppData` JSONB blob with `persons`, `udharEntries`, `expenses` arrays and `settings.expenseCategories`; `normalize.ts` back-fills them for old rows (no Supabase migration — it's one JSONB column). UI adds `/kharcha`, `/udhari`, `/udhari/:personId` routes reached from Dashboard quick-actions (bottom nav stays 4 tabs).

**Tech Stack:** React 18 + TypeScript (Vite), Zustand v5, React Router, Tailwind v3, Vitest + jsdom + jest-dom, Supabase (single JSONB row).

## Global Constraints

Copied from `CLAUDE.md` — every task's requirements implicitly include these:

- **Integer paisa everywhere.** All money is `Paisa` (rupees × 100). Convert only at the UI edge: `toPaisa()` on input, `formatPKR()` on display. Literals use the `5000_00` underscore style.
- **The golden invariant:** `totalCash(drawer) === Σ cashMovements[].delta`. Every cash settlement creates a `CashMovement` whose `notes` exactly match the drawer change. Wallet settlements create no cash movement and do not touch the drawer.
- **Domain functions are pure, immutable, deterministic.** Return new objects, never mutate inputs, never call `crypto.randomUUID()` / `new Date()` — `id` and `createdAt` are passed *in*. Only store actions generate ids/timestamps, then delegate to the pure function.
- **`verbatimModuleSyntax` is ON** (plus `noUnusedLocals`/`noUnusedParameters`). Every type-only import MUST be `import type { … }` (or inline `import { type X, y }`). Unused imports/vars fail the build.
- **`applyNoteDelta` throws `Error('NEGATIVE_NOTES')`** when a denomination would go negative. UI call sites must `catch` it and show a message — never a silent no-op.
- **`npm test` does NOT type-check.** Run `npm run build` (`tsc -b && vite build`) before declaring any task done. The build type-checks test files too — adding a required field to `AppData` breaks every typed `AppData` literal until updated.
- **Architecture flow:** domain ← data ← store ← UI. Lower layers never import upward (domain may import sibling domain modules and the `AppData` *type*, which is the existing pattern in `transaction.ts`).
- **Zustand v5 trap:** never write a store selector that returns a fresh object/array — it causes infinite re-renders. Derive such values in the component with `useMemo` over the raw slice.

**Commands:**
- One test file: `npx vitest run <pattern>` (substring match on path)
- Full suite: `npm test`
- Type-check + build gate: `npm run build`
- Lint: `npm run lint`

---

## File Map

**Create:**
- `src/domain/expense.ts` — `Expense`, `ExpenseInput`, `DEFAULT_EXPENSE_CATEGORIES`, `applyExpense`, `deleteExpense`
- `src/domain/expense.test.ts`
- `src/domain/udhar.ts` — `Person`, `UdharType`, `UdharEntry`, `UdharInput`, `personBalance`, `udharTotals`, `applyUdhar`, `deleteUdhar`
- `src/domain/udhar.test.ts`
- `src/pages/Kharcha.tsx` + `src/pages/Kharcha.test.tsx`
- `src/pages/Udhari.tsx` + `src/pages/Udhari.test.tsx`
- `src/pages/PersonDetail.tsx` + `src/pages/PersonDetail.test.tsx`

**Modify:**
- `src/domain/cash.ts` — add `negateNotes`; `cash.test.ts` — test it
- `src/domain/wallet.ts` — add `PaymentMethod` type
- `src/domain/transaction.ts` — widen `CashMovement['sourceType']`
- `src/domain/transaction.test.ts` — fix `baseData()` literal
- `src/domain/summary.ts` — add `summarizeExpenses`, `todaysExpenses`, `totalWorth`; `summary.test.ts` — test them
- `src/data/types.ts` — `Settings.expenseCategories`; `AppData.persons/udharEntries/expenses`
- `src/data/seed.ts` — seed the new fields
- `src/data/normalize.ts` — back-fill the new fields; `normalize.test.ts` — test
- `src/store/appStore.ts` — actions `addExpense`, `deleteExpense`, `addPerson`, `updatePerson`, `addUdhar`, `deleteUdhar`; `appStore.test.ts` — test
- `src/App.tsx` — routes `/kharcha`, `/udhari`, `/udhari/:personId`
- `src/pages/Dashboard.tsx` — Total Worth, today's kharcha, Kharcha/Udhar quick-actions; `Dashboard.test.tsx` — assert
- `src/pages/Settings.tsx` — expense-category editor; `Settings.test.tsx` — assert
- `CLAUDE.md` — Phase 3 status + new modules

---

## Task 1: Data-model foundation (types, defaults, back-compat)

Lay down every shared type and `AppData` field so later tasks add only functions to existing files and the build stays green throughout.

**Files:**
- Modify: `src/domain/cash.ts` (add `negateNotes`)
- Test: `src/domain/cash.test.ts`
- Modify: `src/domain/wallet.ts` (add `PaymentMethod`)
- Create: `src/domain/expense.ts` (interfaces + default categories only)
- Create: `src/domain/udhar.ts` (interfaces only)
- Modify: `src/domain/transaction.ts:24-32` (widen `sourceType`)
- Modify: `src/data/types.ts`
- Modify: `src/data/seed.ts`
- Modify: `src/data/normalize.ts`
- Test: `src/data/normalize.test.ts`
- Modify: `src/domain/transaction.test.ts:7-15` (fix `baseData()` literal)

**Interfaces produced (later tasks rely on these exact names/types):**
- `negateNotes(notes: Record<number, number>): Record<number, number>` (cash.ts)
- `type PaymentMethod = 'cash' | 'wallet'` (wallet.ts)
- `interface Expense { id: string; category: string; amount: Paisa; payment: PaymentMethod; walletId: string | null; note?: string; createdAt: string }` (expense.ts)
- `const DEFAULT_EXPENSE_CATEGORIES: string[]` (expense.ts)
- `interface Person { id: string; name: string; phone?: string }` (udhar.ts)
- `type UdharType = 'given' | 'repayment'` (udhar.ts)
- `interface UdharEntry { id: string; personId: string; type: UdharType; amount: Paisa; payment: PaymentMethod; walletId: string | null; note?: string; createdAt: string }` (udhar.ts)
- `CashMovement['sourceType']` widened to `'transaction' | 'adjustment' | 'kharcha' | 'udhar'`
- `AppData` gains `persons: Person[]`, `udharEntries: UdharEntry[]`, `expenses: Expense[]`; `Settings` gains `expenseCategories: string[]`

- [ ] **Step 1: Write the failing test for `negateNotes`**

Append to `src/domain/cash.test.ts` (add `negateNotes` to the existing import from `./cash`):

```typescript
describe('negateNotes', () => {
  it('flips the sign of every count', () => {
    expect(negateNotes({ 5000: 1, 100: 2 })).toEqual({ 5000: -1, 100: -2 })
  })
  it('returns an empty map unchanged', () => {
    expect(negateNotes({})).toEqual({})
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run cash`
Expected: FAIL — `negateNotes is not a function` / not exported.

- [ ] **Step 3: Implement `negateNotes` in `src/domain/cash.ts`**

Append to `src/domain/cash.ts`:

```typescript
/** Flip the sign of every count in a note map. */
export function negateNotes(notes: Record<number, number>): Record<number, number> {
  const out: Record<number, number> = {}
  for (const [value, count] of Object.entries(notes)) out[Number(value)] = -count
  return out
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run cash`
Expected: PASS.

- [ ] **Step 5: Add `PaymentMethod` to `src/domain/wallet.ts`**

Append to `src/domain/wallet.ts`:

```typescript
/** How a kharcha/udhar settles: physical drawer cash, or a digital wallet. */
export type PaymentMethod = 'cash' | 'wallet'
```

- [ ] **Step 6: Create `src/domain/expense.ts` (types + defaults only)**

```typescript
import type { Paisa } from './money'
import type { PaymentMethod } from './wallet'

/** Seed categories for a fresh shop; editable in Settings. */
export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Bijli',
  'Chai / Khana',
  'Rent',
  'Salary',
  'Maintenance',
  'Other',
]

export interface Expense {
  id: string
  category: string
  amount: Paisa
  payment: PaymentMethod
  /** Set when payment === 'wallet'; null for cash. */
  walletId: string | null
  note?: string
  createdAt: string
}
```

- [ ] **Step 7: Create `src/domain/udhar.ts` (types only)**

```typescript
import type { Paisa } from './money'
import type { PaymentMethod } from './wallet'

export interface Person {
  id: string
  name: string
  phone?: string
}

/** 'given' = shop pays the person (they now owe the shop); 'repayment' = person pays the shop back. */
export type UdharType = 'given' | 'repayment'

export interface UdharEntry {
  id: string
  personId: string
  type: UdharType
  amount: Paisa
  payment: PaymentMethod
  /** Set when payment === 'wallet'; null for cash. */
  walletId: string | null
  note?: string
  createdAt: string
}
```

- [ ] **Step 8: Widen `CashMovement['sourceType']` in `src/domain/transaction.ts`**

Change line 26 inside `interface CashMovement`:

```typescript
  sourceType: 'transaction' | 'adjustment' | 'kharcha' | 'udhar'
```

- [ ] **Step 9: Extend `src/data/types.ts`**

Replace the whole file with:

```typescript
import type { Denomination } from '../domain/denominations'
import type { Wallet } from '../domain/wallet'
import type { DrawerCounts } from '../domain/cash'
import type { Transaction, CashMovement } from '../domain/transaction'
import type { Expense } from '../domain/expense'
import type { Person, UdharEntry } from '../domain/udhar'

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
}
```

- [ ] **Step 10: Seed the new fields in `src/data/seed.ts`**

Add the import and the four fields:

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
  }
}
```

- [ ] **Step 11: Write the failing back-compat test in `src/data/normalize.test.ts`**

Add a third test inside the existing `describe('normalizeAppData', …)`:

```typescript
  it('back-fills phase-3 fields and default categories for old data', () => {
    const old = {
      settings: { shopName: 'X', pin: '1234', denominations: [] },
      wallets: [],
      drawer: {},
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const n = normalizeAppData(old)
    expect(n.persons).toEqual([])
    expect(n.udharEntries).toEqual([])
    expect(n.expenses).toEqual([])
    expect(n.settings.expenseCategories.length).toBeGreaterThan(0)
  })
```

- [ ] **Step 12: Run it to confirm it fails**

Run: `npx vitest run normalize`
Expected: FAIL — `n.persons` is `undefined`.

- [ ] **Step 13: Update `src/data/normalize.ts`**

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
  }
}
```

- [ ] **Step 14: Fix the typed `AppData` literal in `src/domain/transaction.test.ts`**

In `baseData()` (lines 7-15) add the new fields and `expenseCategories`:

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
  }
}
```

- [ ] **Step 15: Run the full suite + build gate**

Run: `npm test`
Expected: PASS (all existing + new tests).
Run: `npm run build`
Expected: no type errors (confirms every `AppData` literal compiles).

- [ ] **Step 16: Commit**

```bash
git add src/domain/cash.ts src/domain/cash.test.ts src/domain/wallet.ts src/domain/expense.ts src/domain/udhar.ts src/domain/transaction.ts src/domain/transaction.test.ts src/data/types.ts src/data/seed.ts src/data/normalize.ts src/data/normalize.test.ts
git commit -m "feat(phase3): data-model foundation for kharcha + udhari"
```

---

## Task 2: Expense domain — `applyExpense` / `deleteExpense`

**Files:**
- Modify: `src/domain/expense.ts` (add `ExpenseInput`, `applyExpense`, `deleteExpense`)
- Test: `src/domain/expense.test.ts`

**Interfaces:**
- Consumes: `AppData` (data/types), `applyNoteDelta`, `totalCash`, `negateNotes` (cash), `applyWalletDelta` (wallet), `CashMovement` (transaction), `Expense`, `PaymentMethod` (own module).
- Produces:
  - `interface ExpenseInput { id: string; createdAt: string; category: string; amount: Paisa; payment: PaymentMethod; walletId: string | null; notesOut: Record<number, number>; note?: string }`
  - `applyExpense(data: AppData, input: ExpenseInput): AppData`
  - `deleteExpense(data: AppData, expenseId: string): AppData`

**Behaviour:** Cash expense → `notesOut` leave the drawer (`negateNotes`), `cashDelta = -totalCash(notesOut)`, push a `'kharcha'` `CashMovement` with id `${input.id}-c`. Wallet expense → selected wallet balance decreases by `amount`, no drawer change, no cash movement. Both prepend the `Expense` record. `deleteExpense` reverses exactly. Throws `NEGATIVE_NOTES` if a cash expense exceeds the drawer.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/expense.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import { applyExpense, deleteExpense, type ExpenseInput } from './expense'

function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: ['Bijli'] },
    wallets: [{ id: 'easypaisa', name: 'Easypaisa', balance: 5000_00 }],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 100: 10 }, // Rs 1000 in drawer
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
  }
}

const cashExpense: ExpenseInput = {
  id: 'e1',
  createdAt: '2026-06-23T10:00:00.000Z',
  category: 'Bijli',
  amount: 300_00,
  payment: 'cash',
  walletId: null,
  notesOut: { 100: 3 },
}

describe('applyExpense (cash)', () => {
  it('removes notes from the drawer and logs a kharcha cash movement', () => {
    const next = applyExpense(baseData(), cashExpense)
    expect(next.drawer[100]).toBe(7)
    expect(next.expenses).toHaveLength(1)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].sourceType).toBe('kharcha')
    expect(next.cashMovements[0].delta).toBe(-300_00)
  })

  it('keeps the golden invariant (drawer === starting cash + sum of movements)', () => {
    const start = baseData()
    const next = applyExpense(start, cashExpense)
    const movementSum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(next.drawer)).toBe(totalCash(start.drawer) + movementSum)
  })

  it('does not touch any wallet', () => {
    const next = applyExpense(baseData(), cashExpense)
    expect(next.wallets[0].balance).toBe(5000_00)
  })

  it('throws NEGATIVE_NOTES when cash paid exceeds the drawer', () => {
    const input: ExpenseInput = { ...cashExpense, id: 'e2', notesOut: { 100: 11 } }
    expect(() => applyExpense(baseData(), input)).toThrow('NEGATIVE_NOTES')
  })

  it('does not mutate the input data', () => {
    const data = baseData()
    applyExpense(data, cashExpense)
    expect(data.expenses).toHaveLength(0)
    expect(data.drawer[100]).toBe(10)
  })
})

describe('applyExpense (wallet)', () => {
  const walletExpense: ExpenseInput = {
    id: 'e3',
    createdAt: '2026-06-23T10:00:00.000Z',
    category: 'Bijli',
    amount: 1200_00,
    payment: 'wallet',
    walletId: 'easypaisa',
    notesOut: {},
  }

  it('decreases the wallet and logs no cash movement', () => {
    const next = applyExpense(baseData(), walletExpense)
    expect(next.wallets[0].balance).toBe(3800_00)
    expect(next.cashMovements).toHaveLength(0)
    expect(next.drawer[100]).toBe(10)
    expect(next.expenses[0].payment).toBe('wallet')
  })
})

describe('deleteExpense', () => {
  it('reverses a cash expense (drawer + movement + record)', () => {
    const after = applyExpense(baseData(), cashExpense)
    const reverted = deleteExpense(after, 'e1')
    expect(reverted.expenses).toHaveLength(0)
    expect(reverted.cashMovements).toHaveLength(0)
    expect(reverted.drawer[100]).toBe(10)
  })

  it('reverses a wallet expense', () => {
    const input: ExpenseInput = { id: 'e4', createdAt: '2026-06-23T10:00:00.000Z', category: 'Bijli', amount: 1000_00, payment: 'wallet', walletId: 'easypaisa', notesOut: {} }
    const after = applyExpense(baseData(), input)
    const reverted = deleteExpense(after, 'e4')
    expect(reverted.wallets[0].balance).toBe(5000_00)
    expect(reverted.expenses).toHaveLength(0)
  })

  it('returns data unchanged for an unknown id', () => {
    const after = applyExpense(baseData(), cashExpense)
    expect(deleteExpense(after, 'nope').expenses).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run expense`
Expected: FAIL — `applyExpense is not a function`.

- [ ] **Step 3: Implement in `src/domain/expense.ts`**

Add the imports at the top (the existing `DEFAULT_EXPENSE_CATEGORIES` and `Expense` interface stay above) and append the functions:

```typescript
import type { Paisa } from './money'
import type { PaymentMethod } from './wallet'
import type { AppData } from '../data/types'
import type { CashMovement } from './transaction'
import { applyNoteDelta, totalCash, negateNotes } from './cash'
import { applyWalletDelta } from './wallet'

// ... existing DEFAULT_EXPENSE_CATEGORIES and Expense interface stay above ...

export interface ExpenseInput {
  id: string
  createdAt: string
  category: string
  amount: Paisa
  payment: PaymentMethod
  walletId: string | null
  /** Notes physically removed from the drawer (cash payment only). */
  notesOut: Record<number, number>
  note?: string
}

/** Apply a kharcha. Pure/immutable. Throws Error('NEGATIVE_NOTES') if a cash expense exceeds the drawer. */
export function applyExpense(data: AppData, input: ExpenseInput): AppData {
  const expense: Expense = {
    id: input.id,
    category: input.category,
    amount: input.amount,
    payment: input.payment,
    walletId: input.payment === 'wallet' ? input.walletId : null,
    note: input.note,
    createdAt: input.createdAt,
  }

  if (input.payment === 'wallet') {
    const wallets = data.wallets.map((w) =>
      w.id === input.walletId ? applyWalletDelta(w, -input.amount) : w,
    )
    return { ...data, wallets, expenses: [expense, ...data.expenses] }
  }

  // cash
  const noteDelta = negateNotes(input.notesOut)
  const cashDelta: Paisa = -totalCash(input.notesOut)
  const drawer = applyNoteDelta(data.drawer, noteDelta)
  const movement: CashMovement = {
    id: `${input.id}-c`,
    sourceType: 'kharcha',
    sourceId: input.id,
    delta: cashDelta,
    notes: noteDelta,
    note: input.note,
    createdAt: input.createdAt,
  }
  return {
    ...data,
    drawer,
    expenses: [expense, ...data.expenses],
    cashMovements: [movement, ...data.cashMovements],
  }
}

/** Remove a kharcha and reverse its effect. Returns data unchanged if not found. Throws NEGATIVE_NOTES if the drawer can no longer give the notes back. */
export function deleteExpense(data: AppData, expenseId: string): AppData {
  const expense = data.expenses.find((e) => e.id === expenseId)
  if (!expense) return data

  if (expense.payment === 'wallet') {
    const wallets = data.wallets.map((w) =>
      w.id === expense.walletId ? applyWalletDelta(w, expense.amount) : w,
    )
    return { ...data, wallets, expenses: data.expenses.filter((e) => e.id !== expenseId) }
  }

  const movement = data.cashMovements.find((m) => m.sourceId === expenseId)
  const drawer = movement ? applyNoteDelta(data.drawer, negateNotes(movement.notes)) : data.drawer
  return {
    ...data,
    drawer,
    expenses: data.expenses.filter((e) => e.id !== expenseId),
    cashMovements: data.cashMovements.filter((m) => m.sourceId !== expenseId),
  }
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run expense`
Expected: PASS.

- [ ] **Step 5: Build gate**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/expense.ts src/domain/expense.test.ts
git commit -m "feat(phase3): expense domain (applyExpense/deleteExpense)"
```

---

## Task 3: Expense store actions

**Files:**
- Modify: `src/store/appStore.ts`
- Test: `src/store/appStore.test.ts`

**Interfaces:**
- Consumes: `applyExpense`, `deleteExpense`, `ExpenseInput` (domain/expense).
- Produces on `AppState`:
  - `addExpense: (input: Omit<ExpenseInput, 'id' | 'createdAt'>) => Promise<void>`
  - `deleteExpense: (id: string) => Promise<void>`

- [ ] **Step 1: Write the failing test**

Append to `src/store/appStore.test.ts`:

```typescript
describe('appStore expenses', () => {
  it('addExpense (cash) reduces the drawer, logs a movement, persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 100: 10 } } })

    await useAppStore.getState().addExpense({
      category: 'Bijli',
      amount: 300_00,
      payment: 'cash',
      walletId: null,
      notesOut: { 100: 3 },
    })

    const data = useAppStore.getState().data!
    expect(data.expenses).toHaveLength(1)
    expect(data.expenses[0].id).toBeTruthy()
    expect(data.drawer[100]).toBe(7)
    expect((await repo.load()).expenses).toHaveLength(1)
  })

  it('deleteExpense reverses and persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 100: 10 } } })
    await useAppStore.getState().addExpense({ category: 'Bijli', amount: 100_00, payment: 'cash', walletId: null, notesOut: { 100: 1 } })
    const id = useAppStore.getState().data!.expenses[0].id
    await useAppStore.getState().deleteExpense(id)
    expect(useAppStore.getState().data!.expenses).toHaveLength(0)
    expect(useAppStore.getState().data!.drawer[100]).toBe(10)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run appStore`
Expected: FAIL — `addExpense is not a function`.

- [ ] **Step 3: Implement the actions**

In `src/store/appStore.ts`: add imports, the interface members, and the actions.

Add to imports:

```typescript
import { applyExpense, deleteExpense as deleteExpenseDomain } from '../domain/expense'
import type { ExpenseInput } from '../domain/expense'
```

Add to the `AppState` interface:

```typescript
  addExpense: (input: Omit<ExpenseInput, 'id' | 'createdAt'>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
```

Add the actions inside the store (after `deleteTransaction`):

```typescript
  async addExpense(input) {
    const { repo, data } = get()
    if (!repo || !data) return
    const full: ExpenseInput = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    const next = applyExpense(data, full)
    await repo.save(next)
    set({ data: next })
  },

  async deleteExpense(id) {
    const { repo, data } = get()
    if (!repo || !data) return
    const next = deleteExpenseDomain(data, id)
    await repo.save(next)
    set({ data: next })
  },
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run appStore`
Expected: PASS.

- [ ] **Step 5: Build gate**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts
git commit -m "feat(phase3): expense store actions"
```

---

## Task 4: Udhar domain — balances + `applyUdhar` / `deleteUdhar`

**Files:**
- Modify: `src/domain/udhar.ts` (add `UdharInput`, `personBalance`, `udharTotals`, `applyUdhar`, `deleteUdhar`)
- Test: `src/domain/udhar.test.ts`

**Interfaces:**
- Consumes: `AppData`, `applyNoteDelta`, `totalCash`, `negateNotes`, `applyWalletDelta`, `CashMovement`, plus own `Person`/`UdharEntry`/`UdharType`/`PaymentMethod`.
- Produces:
  - `interface UdharInput { id: string; createdAt: string; personId: string; type: UdharType; amount: Paisa; payment: PaymentMethod; walletId: string | null; notes: Record<number, number>; note?: string }`
  - `personBalance(entries: UdharEntry[], personId: string): Paisa` — `Σ given − Σ repayment`; positive ⇒ person owes the shop.
  - `udharTotals(entries: UdharEntry[], persons: Person[]): { receivable: Paisa; payable: Paisa }` — receivable = Σ positive balances; payable = Σ |negative balances|.
  - `applyUdhar(data: AppData, input: UdharInput): AppData`
  - `deleteUdhar(data: AppData, entryId: string): AppData`

**Behaviour:** `given` = money leaves the shop (cash: `notes` out of drawer / wallet: `-amount`); `repayment` = money enters (cash: `notes` into drawer / wallet: `+amount`). Cash settlements push a `'udhar'` `CashMovement` (id `${input.id}-c`); wallet settlements push none. `applyUdhar` does NOT create the person — the store guarantees `personId` exists.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/udhar.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import { applyUdhar, deleteUdhar, personBalance, udharTotals, type UdharInput } from './udhar'

function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: [] },
    wallets: [{ id: 'easypaisa', name: 'Easypaisa', balance: 5000_00 }],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 1000: 5 }, // Rs 5000 in drawer
    transactions: [],
    cashMovements: [],
    persons: [{ id: 'p1', name: 'Ali' }],
    udharEntries: [],
    expenses: [],
  }
}

const given: UdharInput = {
  id: 'u1',
  createdAt: '2026-06-23T10:00:00.000Z',
  personId: 'p1',
  type: 'given',
  amount: 2000_00,
  payment: 'cash',
  walletId: null,
  notes: { 1000: 2 },
}

describe('applyUdhar (cash given)', () => {
  it('removes cash, logs a udhar movement, records the entry', () => {
    const next = applyUdhar(baseData(), given)
    expect(next.drawer[1000]).toBe(3)
    expect(next.udharEntries).toHaveLength(1)
    expect(next.cashMovements[0].sourceType).toBe('udhar')
    expect(next.cashMovements[0].delta).toBe(-2000_00)
  })

  it('keeps the golden invariant', () => {
    const start = baseData()
    const next = applyUdhar(start, given)
    const sum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(next.drawer)).toBe(totalCash(start.drawer) + sum)
  })

  it('throws NEGATIVE_NOTES when giving more cash than the drawer holds', () => {
    expect(() => applyUdhar(baseData(), { ...given, id: 'u9', notes: { 1000: 6 } })).toThrow('NEGATIVE_NOTES')
  })
})

describe('applyUdhar (cash repayment)', () => {
  const repay: UdharInput = { ...given, id: 'u2', type: 'repayment', amount: 500_00, notes: { 100: 5 } }
  it('adds cash and logs a positive movement', () => {
    const next = applyUdhar(baseData(), repay)
    expect(next.cashMovements[0].delta).toBe(500_00)
    expect(next.drawer[100]).toBe(5)
  })
})

describe('applyUdhar (wallet)', () => {
  it('given via wallet decreases the balance, no cash movement', () => {
    const next = applyUdhar(baseData(), { ...given, id: 'u3', payment: 'wallet', walletId: 'easypaisa', notes: {} })
    expect(next.wallets[0].balance).toBe(3000_00)
    expect(next.cashMovements).toHaveLength(0)
  })
  it('repayment via wallet increases the balance', () => {
    const next = applyUdhar(baseData(), { ...given, id: 'u4', type: 'repayment', amount: 1000_00, payment: 'wallet', walletId: 'easypaisa', notes: {} })
    expect(next.wallets[0].balance).toBe(6000_00)
  })
})

describe('personBalance + udharTotals', () => {
  it('nets given minus repayment per person', () => {
    let data = applyUdhar(baseData(), given) // p1 owes 2000
    data = applyUdhar(data, { ...given, id: 'u5', type: 'repayment', amount: 500_00, notes: { 100: 5 } }) // pays 500
    expect(personBalance(data.udharEntries, 'p1')).toBe(1500_00)
  })

  it('splits receivable and payable across people', () => {
    const data: AppData = {
      ...baseData(),
      persons: [{ id: 'p1', name: 'Ali' }, { id: 'p2', name: 'Sara' }],
      udharEntries: [
        { id: 'a', personId: 'p1', type: 'given', amount: 1000_00, payment: 'cash', walletId: null, createdAt: '' },
        { id: 'b', personId: 'p2', type: 'repayment', amount: 700_00, payment: 'cash', walletId: null, createdAt: '' },
      ],
    }
    expect(udharTotals(data.udharEntries, data.persons)).toEqual({ receivable: 1000_00, payable: 700_00 })
  })
})

describe('deleteUdhar', () => {
  it('reverses a cash given entry', () => {
    const after = applyUdhar(baseData(), given)
    const reverted = deleteUdhar(after, 'u1')
    expect(reverted.udharEntries).toHaveLength(0)
    expect(reverted.cashMovements).toHaveLength(0)
    expect(reverted.drawer[1000]).toBe(5)
  })
  it('reverses a wallet given entry', () => {
    const after = applyUdhar(baseData(), { ...given, id: 'u6', payment: 'wallet', walletId: 'easypaisa', notes: {} })
    const reverted = deleteUdhar(after, 'u6')
    expect(reverted.wallets[0].balance).toBe(5000_00)
  })
  it('returns data unchanged for an unknown id', () => {
    const after = applyUdhar(baseData(), given)
    expect(deleteUdhar(after, 'nope').udharEntries).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run udhar`
Expected: FAIL — `applyUdhar is not a function`.

- [ ] **Step 3: Implement in `src/domain/udhar.ts`**

Add imports at the top and append below the existing interfaces:

```typescript
import type { Paisa } from './money'
import type { PaymentMethod } from './wallet'
import type { AppData } from '../data/types'
import type { CashMovement } from './transaction'
import { applyNoteDelta, totalCash, negateNotes } from './cash'
import { applyWalletDelta } from './wallet'

// ... existing Person, UdharType, UdharEntry interfaces stay above ...

export interface UdharInput {
  id: string
  createdAt: string
  personId: string
  type: UdharType
  amount: Paisa
  payment: PaymentMethod
  walletId: string | null
  /** Notes leaving (given) or arriving (repayment) — cash only. */
  notes: Record<number, number>
  note?: string
}

/** Net of given minus repayment for one person. Positive ⇒ the person owes the shop. */
export function personBalance(entries: UdharEntry[], personId: string): Paisa {
  let bal = 0
  for (const e of entries) {
    if (e.personId !== personId) continue
    bal += e.type === 'given' ? e.amount : -e.amount
  }
  return bal
}

export function udharTotals(
  entries: UdharEntry[],
  persons: Person[],
): { receivable: Paisa; payable: Paisa } {
  let receivable = 0
  let payable = 0
  for (const p of persons) {
    const bal = personBalance(entries, p.id)
    if (bal > 0) receivable += bal
    else if (bal < 0) payable += -bal
  }
  return { receivable, payable }
}

/** Apply an udhar entry. Pure/immutable. Throws Error('NEGATIVE_NOTES') if a cash 'given' exceeds the drawer. */
export function applyUdhar(data: AppData, input: UdharInput): AppData {
  const entry: UdharEntry = {
    id: input.id,
    personId: input.personId,
    type: input.type,
    amount: input.amount,
    payment: input.payment,
    walletId: input.payment === 'wallet' ? input.walletId : null,
    note: input.note,
    createdAt: input.createdAt,
  }
  const outward = input.type === 'given' // money leaving the shop

  if (input.payment === 'wallet') {
    const delta = outward ? -input.amount : input.amount
    const wallets = data.wallets.map((w) =>
      w.id === input.walletId ? applyWalletDelta(w, delta) : w,
    )
    return { ...data, wallets, udharEntries: [entry, ...data.udharEntries] }
  }

  // cash
  const noteDelta = outward ? negateNotes(input.notes) : input.notes
  const cashTotal = totalCash(input.notes)
  const cashDelta: Paisa = outward ? -cashTotal : cashTotal
  const drawer = applyNoteDelta(data.drawer, noteDelta)
  const movement: CashMovement = {
    id: `${input.id}-c`,
    sourceType: 'udhar',
    sourceId: input.id,
    delta: cashDelta,
    notes: noteDelta,
    note: input.note,
    createdAt: input.createdAt,
  }
  return {
    ...data,
    drawer,
    udharEntries: [entry, ...data.udharEntries],
    cashMovements: [movement, ...data.cashMovements],
  }
}

/** Remove an udhar entry and reverse its effect. Returns data unchanged if not found. Throws NEGATIVE_NOTES if the drawer can no longer reverse it. */
export function deleteUdhar(data: AppData, entryId: string): AppData {
  const entry = data.udharEntries.find((e) => e.id === entryId)
  if (!entry) return data

  if (entry.payment === 'wallet') {
    const reverse = entry.type === 'given' ? entry.amount : -entry.amount
    const wallets = data.wallets.map((w) =>
      w.id === entry.walletId ? applyWalletDelta(w, reverse) : w,
    )
    return { ...data, wallets, udharEntries: data.udharEntries.filter((e) => e.id !== entryId) }
  }

  const movement = data.cashMovements.find((m) => m.sourceId === entryId)
  const drawer = movement ? applyNoteDelta(data.drawer, negateNotes(movement.notes)) : data.drawer
  return {
    ...data,
    drawer,
    udharEntries: data.udharEntries.filter((e) => e.id !== entryId),
    cashMovements: data.cashMovements.filter((m) => m.sourceId !== entryId),
  }
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run udhar`
Expected: PASS.

- [ ] **Step 5: Build gate**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/udhar.ts src/domain/udhar.test.ts
git commit -m "feat(phase3): udhar domain (balances + applyUdhar/deleteUdhar)"
```

---

## Task 5: Udhar store actions

**Files:**
- Modify: `src/store/appStore.ts`
- Test: `src/store/appStore.test.ts`

**Interfaces:**
- Consumes: `applyUdhar`, `deleteUdhar`, `UdharInput` (domain/udhar), `Person` (domain/udhar).
- Produces on `AppState`:
  - `addPerson: (name: string, phone?: string) => Promise<string>` — returns the new person id
  - `updatePerson: (id: string, patch: Partial<Pick<Person, 'name' | 'phone'>>) => Promise<void>`
  - `addUdhar: (input: Omit<UdharInput, 'id' | 'createdAt'>) => Promise<void>`
  - `deleteUdhar: (id: string) => Promise<void>`

- [ ] **Step 1: Write the failing test**

Append to `src/store/appStore.test.ts`:

```typescript
describe('appStore udhari', () => {
  it('addPerson appends a person and returns its id', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    const id = await useAppStore.getState().addPerson('Ali', '03001234567')
    expect(id).toBeTruthy()
    const p = useAppStore.getState().data!.persons.find((x) => x.id === id)!
    expect(p.name).toBe('Ali')
    expect((await repo.load()).persons).toHaveLength(1)
  })

  it('addUdhar (cash given) records an entry and reduces the drawer', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } })
    const id = await useAppStore.getState().addPerson('Ali')
    await useAppStore.getState().addUdhar({ personId: id, type: 'given', amount: 2000_00, payment: 'cash', walletId: null, notes: { 1000: 2 } })
    const data = useAppStore.getState().data!
    expect(data.udharEntries).toHaveLength(1)
    expect(data.drawer[1000]).toBe(3)
  })

  it('deleteUdhar reverses the entry', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } })
    const id = await useAppStore.getState().addPerson('Ali')
    await useAppStore.getState().addUdhar({ personId: id, type: 'given', amount: 1000_00, payment: 'cash', walletId: null, notes: { 1000: 1 } })
    const entryId = useAppStore.getState().data!.udharEntries[0].id
    await useAppStore.getState().deleteUdhar(entryId)
    expect(useAppStore.getState().data!.udharEntries).toHaveLength(0)
    expect(useAppStore.getState().data!.drawer[1000]).toBe(5)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run appStore`
Expected: FAIL — `addPerson is not a function`.

- [ ] **Step 3: Implement the actions**

Add to imports in `src/store/appStore.ts`:

```typescript
import { applyUdhar, deleteUdhar as deleteUdharDomain } from '../domain/udhar'
import type { UdharInput, Person } from '../domain/udhar'
```

Add to the `AppState` interface:

```typescript
  addPerson: (name: string, phone?: string) => Promise<string>
  updatePerson: (id: string, patch: Partial<Pick<Person, 'name' | 'phone'>>) => Promise<void>
  addUdhar: (input: Omit<UdharInput, 'id' | 'createdAt'>) => Promise<void>
  deleteUdhar: (id: string) => Promise<void>
```

Add the actions inside the store:

```typescript
  async addPerson(name, phone) {
    const { repo, data } = get()
    if (!repo || !data) return ''
    const person: Person = { id: crypto.randomUUID(), name, phone: phone || undefined }
    const next: AppData = { ...data, persons: [...data.persons, person] }
    await repo.save(next)
    set({ data: next })
    return person.id
  },

  async updatePerson(id, patch) {
    const { repo, data } = get()
    if (!repo || !data) return
    const persons = data.persons.map((p) => (p.id === id ? { ...p, ...patch } : p))
    const next: AppData = { ...data, persons }
    await repo.save(next)
    set({ data: next })
  },

  async addUdhar(input) {
    const { repo, data } = get()
    if (!repo || !data) return
    const full: UdharInput = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    const next = applyUdhar(data, full)
    await repo.save(next)
    set({ data: next })
  },

  async deleteUdhar(id) {
    const { repo, data } = get()
    if (!repo || !data) return
    const next = deleteUdharDomain(data, id)
    await repo.save(next)
    set({ data: next })
  },
```

> Note: `addPerson` returns `Promise<string>`; the `if (!repo || !data) return ''` guard keeps that contract. `data.persons` is non-null because `init` always loads normalized data.

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run appStore`
Expected: PASS.

- [ ] **Step 5: Build gate**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts
git commit -m "feat(phase3): udhari store actions"
```

---

## Task 6: Summary helpers (expenses + total worth)

**Files:**
- Modify: `src/domain/summary.ts`
- Test: `src/domain/summary.test.ts`

**Interfaces:**
- Consumes: `Paisa`, `Expense` (domain/expense), existing `isSameDay`.
- Produces:
  - `interface ExpenseSummary { total: Paisa; byCategory: Record<string, Paisa> }`
  - `summarizeExpenses(expenses: Expense[]): ExpenseSummary`
  - `todaysExpenses(expenses: Expense[], ref: Date): Expense[]`
  - `totalWorth(cash: Paisa, walletBalance: Paisa, receivable: Paisa, payable: Paisa): Paisa`

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/summary.test.ts`. If the file already has a top-level `import { describe, it, expect } from 'vitest'`, do NOT duplicate it — only add the two new import lines below and the new `describe` blocks:

```typescript
import { summarizeExpenses, todaysExpenses, totalWorth } from './summary'
import type { Expense } from './expense'

function exp(partial: Partial<Expense>): Expense {
  return { id: 'e', category: 'Bijli', amount: 100_00, payment: 'cash', walletId: null, createdAt: '2026-06-23T10:00:00.000Z', ...partial }
}

describe('summarizeExpenses', () => {
  it('totals and groups by category', () => {
    const s = summarizeExpenses([exp({ amount: 100_00, category: 'Bijli' }), exp({ amount: 50_00, category: 'Chai / Khana' }), exp({ amount: 25_00, category: 'Bijli' })])
    expect(s.total).toBe(175_00)
    expect(s.byCategory['Bijli']).toBe(125_00)
    expect(s.byCategory['Chai / Khana']).toBe(50_00)
  })
})

describe('todaysExpenses', () => {
  it('keeps only same-day expenses', () => {
    const ref = new Date('2026-06-23T12:00:00.000Z')
    const list = [exp({ createdAt: '2026-06-23T08:00:00.000Z' }), exp({ createdAt: '2026-06-22T08:00:00.000Z' })]
    expect(todaysExpenses(list, ref)).toHaveLength(1)
  })
})

describe('totalWorth', () => {
  it('is cash + wallets + receivable - payable', () => {
    expect(totalWorth(1000_00, 5000_00, 2000_00, 300_00)).toBe(7700_00)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run summary`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement in `src/domain/summary.ts`**

Add the import and append the helpers:

```typescript
import type { Expense } from './expense'

export interface ExpenseSummary {
  total: Paisa
  byCategory: Record<string, Paisa>
}

export function summarizeExpenses(expenses: Expense[]): ExpenseSummary {
  const byCategory: Record<string, Paisa> = {}
  let total = 0
  for (const e of expenses) {
    total += e.amount
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
  }
  return { total, byCategory }
}

export function todaysExpenses(expenses: Expense[], ref: Date): Expense[] {
  return expenses.filter((e) => isSameDay(e.createdAt, ref))
}

/** Net worth: drawer cash + all wallet balances + money owed to the shop − money the shop owes. */
export function totalWorth(cash: Paisa, walletBalance: Paisa, receivable: Paisa, payable: Paisa): Paisa {
  return cash + walletBalance + receivable - payable
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run summary`
Expected: PASS.

- [ ] **Step 5: Build gate**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/summary.ts src/domain/summary.test.ts
git commit -m "feat(phase3): summary helpers for expenses and total worth"
```

---

## Task 7: Kharcha page + route

**Files:**
- Create: `src/pages/Kharcha.tsx`
- Create: `src/pages/Kharcha.test.tsx`
- Modify: `src/App.tsx` (add `/kharcha` route)

**Interfaces:**
- Consumes: `useAppStore` (`data`, `addExpense`), `toPaisa`/`formatPKR` (money), `totalCash` (cash), `NotePicker`, `summarizeExpenses`/`todaysExpenses` (summary), `PaymentMethod` (wallet).

**UX:** category `<select>` from `settings.expenseCategories`; amount input; a cash/wallet toggle; `NotePicker` ("Notes Paid") shown only for cash; wallet `<select>` shown only for wallet; optional note; submit. Below the form, today's total and a list of recent expenses. Catch `NEGATIVE_NOTES`.

- [ ] **Step 1: Write the failing test**

Create `src/pages/Kharcha.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import Kharcha from './Kharcha'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 100: 10 } } })
})

function renderPage() {
  return render(
    <MemoryRouter>
      <Kharcha />
    </MemoryRouter>,
  )
}

describe('Kharcha page', () => {
  it('adds a cash expense and reduces the drawer', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '300' } })
    fireEvent.click(screen.getByLabelText('add Rs 100'))
    fireEvent.click(screen.getByLabelText('add Rs 100'))
    fireEvent.click(screen.getByLabelText('add Rs 100'))
    fireEvent.click(screen.getByRole('button', { name: /save kharcha/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.expenses).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.drawer[100]).toBe(7)
  })

  it('shows an error when cash paid exceeds the drawer', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '5000' } })
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getByLabelText('add Rs 100'))
    fireEvent.click(screen.getByRole('button', { name: /save kharcha/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(useAppStore.getState().data!.expenses).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run Kharcha`
Expected: FAIL — cannot resolve `./Kharcha`.

- [ ] **Step 3: Create `src/pages/Kharcha.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { PaymentMethod } from '../domain/wallet'
import { toPaisa, formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import { summarizeExpenses, todaysExpenses } from '../domain/summary'
import NotePicker from '../components/NotePicker'

export default function Kharcha() {
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const addExpense = useAppStore((s) => s.addExpense)

  const [category, setCategory] = useState<string>(data?.settings.expenseCategories[0] ?? 'Other')
  const [amount, setAmount] = useState<number>(0)
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [walletId, setWalletId] = useState<string | null>(data?.wallets[0]?.id ?? null)
  const [notesOut, setNotesOut] = useState<Record<number, number>>({})
  const [note, setNote] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expenses = data?.expenses ?? []
  const todayTotal = useMemo(
    () => summarizeExpenses(todaysExpenses(expenses, new Date())).total,
    [expenses],
  )

  if (!data) return <div className="p-8">Loading…</div>

  const amountPaisa = toPaisa(amount)
  const cashOut = totalCash(notesOut)
  const isValid = amountPaisa > 0 && (payment === 'cash' ? cashOut > 0 : !!walletId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    try {
      await addExpense({
        category,
        amount: amountPaisa,
        payment,
        walletId: payment === 'wallet' ? walletId : null,
        notesOut: payment === 'cash' ? notesOut : {},
        note: note || undefined,
      })
      setAmount(0)
      setNotesOut({})
      setNote('')
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'NEGATIVE_NOTES'
          ? 'Cash paid exceeds the drawer. Adjust the notes and try again.'
          : 'Could not save the kharcha. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Kharcha</h1>
        <div className="text-right text-sm">
          <div className="text-slate-500">Today</div>
          <div className="font-bold text-red-600">{formatPKR(todayTotal)}</div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="category" className="mb-2 block text-sm font-semibold text-slate-600">Category</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border px-3 py-2">
            {data.settings.expenseCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="amount" className="mb-2 block text-sm font-semibold text-slate-600">Amount (Rs)</label>
          <input id="amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full rounded-lg border px-2 py-1 text-right" min="0" step="0.01" />
        </div>

        <div className="rounded-xl border bg-white p-3">
          <span className="mb-2 block text-sm font-semibold text-slate-600">Paid from</span>
          <div className="flex gap-2">
            {(['cash', 'wallet'] as PaymentMethod[]).map((m) => (
              <button key={m} type="button" onClick={() => setPayment(m)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${payment === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {m === 'cash' ? 'Cash' : 'Wallet'}
              </button>
            ))}
          </div>
        </div>

        {payment === 'wallet' ? (
          <div className="rounded-xl border bg-white p-3">
            <label htmlFor="wallet" className="mb-2 block text-sm font-semibold text-slate-600">Wallet</label>
            <select id="wallet" value={walletId ?? ''} onChange={(e) => setWalletId(e.target.value || null)} className="w-full rounded-lg border px-3 py-2">
              {data.wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({formatPKR(w.balance)})</option>
              ))}
            </select>
          </div>
        ) : (
          <NotePicker label="Notes Paid" denominations={data.settings.denominations} counts={notesOut} onChange={setNotesOut} />
        )}

        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="note" className="mb-2 block text-sm font-semibold text-slate-600">Note (optional)</label>
          <input id="note" type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
        </div>

        {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</div>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => navigate('/')} className="rounded-xl bg-slate-200 py-3 font-semibold">Cancel</button>
          <button type="submit" disabled={!isValid || loading} className={`rounded-xl py-3 font-semibold text-white ${isValid && !loading ? 'bg-emerald-600 hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-400'}`}>
            {loading ? 'Saving…' : 'Save Kharcha'}
          </button>
        </div>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Recent</h2>
        <ul className="space-y-1">
          {expenses.slice(0, 20).map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm">
              <span>{e.category} <span className="text-slate-400">· {e.payment}</span></span>
              <span className="font-semibold text-red-600">-{formatPKR(e.amount)}</span>
            </li>
          ))}
          {expenses.length === 0 && <li className="text-sm text-slate-400">No kharcha yet.</li>}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Add the route in `src/App.tsx`**

Add the import and the route under `<Route element={<AppLayout />}>`:

```tsx
import Kharcha from './pages/Kharcha'
// ...
        <Route path="kharcha" element={<Kharcha />} />
```

- [ ] **Step 5: Run to confirm pass**

Run: `npx vitest run Kharcha`
Expected: PASS.

- [ ] **Step 6: Build gate + lint**

Run: `npm run build`
Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Kharcha.tsx src/pages/Kharcha.test.tsx src/App.tsx
git commit -m "feat(phase3): kharcha page + route"
```

---

## Task 8: Udhari list + person-detail pages + routes

**Files:**
- Create: `src/pages/Udhari.tsx` (list of people, totals, add person)
- Create: `src/pages/Udhari.test.tsx`
- Create: `src/pages/PersonDetail.tsx` (one person's history + add given/repayment)
- Create: `src/pages/PersonDetail.test.tsx`
- Modify: `src/App.tsx` (`/udhari`, `/udhari/:personId`)

**Interfaces:**
- Consumes: `useAppStore` (`data`, `addPerson`, `addUdhar`), `personBalance`/`udharTotals` (udhar), `formatPKR`/`toPaisa`, `totalCash`, `NotePicker`, `PaymentMethod`, `UdharType`, `useParams`/`Link`/`useNavigate`.

**UX — Udhari list:** totals (receivable/payable) header; each person row links to `/udhari/:id` showing their `personBalance`; an "Add person" inline form (name + optional phone). **PersonDetail:** shows the person, running balance, a given/repayment toggle, amount, cash/wallet toggle (NotePicker for cash), submit; below, that person's entry history. Catch `NEGATIVE_NOTES`.

- [ ] **Step 1: Write the failing test for the list page**

Create `src/pages/Udhari.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import Udhari from './Udhari'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
})

describe('Udhari list page', () => {
  it('adds a person and lists them', async () => {
    render(<MemoryRouter><Udhari /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ali' } })
    fireEvent.click(screen.getByRole('button', { name: /add person/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.persons).toHaveLength(1)
    })
    expect(screen.getByText('Ali')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run Udhari`
Expected: FAIL — cannot resolve `./Udhari`.

- [ ] **Step 3: Create `src/pages/Udhari.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { formatPKR } from '../domain/money'
import { personBalance, udharTotals } from '../domain/udhar'

export default function Udhari() {
  const data = useAppStore((s) => s.data)
  const addPerson = useAppStore((s) => s.addPerson)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const persons = data?.persons ?? []
  const entries = data?.udharEntries ?? []
  const totals = useMemo(() => udharTotals(entries, persons), [entries, persons])

  if (!data) return <div className="p-8">Loading…</div>

  const handleAdd = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await addPerson(name.trim(), phone.trim() || undefined)
      setName('')
      setPhone('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Udhari</h1>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border bg-white p-3">
          <div className="text-xs text-slate-500">Receivable (lena)</div>
          <div className="text-lg font-bold text-emerald-600">{formatPKR(totals.receivable)}</div>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <div className="text-xs text-slate-500">Payable (dena)</div>
          <div className="text-lg font-bold text-red-600">{formatPKR(totals.payable)}</div>
        </div>
      </div>

      <section className="space-y-2 rounded-xl border bg-white p-3">
        <h2 className="text-sm font-semibold text-slate-600">Add person</h2>
        <label htmlFor="name" className="block text-sm">Name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
        <label htmlFor="phone" className="block text-sm">Phone (optional)</label>
        <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border px-3 py-2" inputMode="tel" />
        <button onClick={handleAdd} disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Add person</button>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">People</h2>
        <ul className="space-y-1">
          {persons.map((p) => {
            const bal = personBalance(entries, p.id)
            return (
              <li key={p.id}>
                <Link to={`/udhari/${p.id}`} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
                  <span>{p.name}</span>
                  <span className={`font-semibold ${bal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {bal >= 0 ? '' : '-'}{formatPKR(Math.abs(bal))}
                  </span>
                </Link>
              </li>
            )
          })}
          {persons.length === 0 && <li className="text-sm text-slate-400">No people yet.</li>}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Write the failing test for PersonDetail**

Create `src/pages/PersonDetail.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import PersonDetail from './PersonDetail'

let personId = ''

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } })
  personId = await useAppStore.getState().addPerson('Ali')
})

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/udhari/${id}`]}>
      <Routes>
        <Route path="/udhari/:personId" element={<PersonDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PersonDetail page', () => {
  it('records a cash udhar given and reduces the drawer', async () => {
    renderAt(personId)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '2000' } })
    fireEvent.click(screen.getByLabelText('add Rs 1000'))
    fireEvent.click(screen.getByLabelText('add Rs 1000'))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.udharEntries).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.drawer[1000]).toBe(3)
  })
})
```

- [ ] **Step 5: Create `src/pages/PersonDetail.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { PaymentMethod } from '../domain/wallet'
import type { UdharType } from '../domain/udhar'
import { personBalance } from '../domain/udhar'
import { toPaisa, formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import NotePicker from '../components/NotePicker'

export default function PersonDetail() {
  const { personId } = useParams<{ personId: string }>()
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const addUdhar = useAppStore((s) => s.addUdhar)

  const [type, setType] = useState<UdharType>('given')
  const [amount, setAmount] = useState<number>(0)
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [walletId, setWalletId] = useState<string | null>(data?.wallets[0]?.id ?? null)
  const [notes, setNotes] = useState<Record<number, number>>({})
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entries = data?.udharEntries ?? []
  const person = data?.persons.find((p) => p.id === personId)
  const balance = useMemo(() => personBalance(entries, personId ?? ''), [entries, personId])
  const mine = useMemo(() => entries.filter((e) => e.personId === personId), [entries, personId])

  if (!data) return <div className="p-8">Loading…</div>
  if (!person) return <div className="p-8">Person not found. <Link to="/udhari" className="text-emerald-600">Back</Link></div>

  const amountPaisa = toPaisa(amount)
  const cashTotal = totalCash(notes)
  const isValid = amountPaisa > 0 && (payment === 'cash' ? cashTotal > 0 : !!walletId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    try {
      await addUdhar({
        personId: person.id,
        type,
        amount: amountPaisa,
        payment,
        walletId: payment === 'wallet' ? walletId : null,
        notes: payment === 'cash' ? notes : {},
        note: note || undefined,
      })
      setAmount(0)
      setNotes({})
      setNote('')
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'NEGATIVE_NOTES'
          ? 'Cash given exceeds the drawer. Adjust the notes and try again.'
          : 'Could not save. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{person.name}</h1>
          {person.phone && <p className="text-sm text-slate-500">{person.phone}</p>}
        </div>
        <div className="text-right text-sm">
          <div className="text-slate-500">{balance >= 0 ? 'Owes you' : 'You owe'}</div>
          <div className={`font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPKR(Math.abs(balance))}</div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          {(['given', 'repayment'] as UdharType[]).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${type === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {t === 'given' ? 'Udhar diya (out)' : 'Wapsi li (in)'}
            </button>
          ))}
        </div>

        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="amount" className="mb-2 block text-sm font-semibold text-slate-600">Amount (Rs)</label>
          <input id="amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full rounded-lg border px-2 py-1 text-right" min="0" step="0.01" />
        </div>

        <div className="rounded-xl border bg-white p-3">
          <span className="mb-2 block text-sm font-semibold text-slate-600">Settled by</span>
          <div className="flex gap-2">
            {(['cash', 'wallet'] as PaymentMethod[]).map((m) => (
              <button key={m} type="button" onClick={() => setPayment(m)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${payment === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {m === 'cash' ? 'Cash' : 'Wallet'}
              </button>
            ))}
          </div>
        </div>

        {payment === 'wallet' ? (
          <div className="rounded-xl border bg-white p-3">
            <label htmlFor="wallet" className="mb-2 block text-sm font-semibold text-slate-600">Wallet</label>
            <select id="wallet" value={walletId ?? ''} onChange={(e) => setWalletId(e.target.value || null)} className="w-full rounded-lg border px-3 py-2">
              {data.wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({formatPKR(w.balance)})</option>
              ))}
            </select>
          </div>
        ) : (
          <NotePicker label={type === 'given' ? 'Notes Out' : 'Notes In'} denominations={data.settings.denominations} counts={notes} onChange={setNotes} />
        )}

        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="note" className="mb-2 block text-sm font-semibold text-slate-600">Note (optional)</label>
          <input id="note" type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
        </div>

        {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</div>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => navigate('/udhari')} className="rounded-xl bg-slate-200 py-3 font-semibold">Back</button>
          <button type="submit" disabled={!isValid || loading} className={`rounded-xl py-3 font-semibold text-white ${isValid && !loading ? 'bg-emerald-600 hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-400'}`}>
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">History</h2>
        <ul className="space-y-1">
          {mine.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm">
              <span>{e.type === 'given' ? 'Diya' : 'Wapsi'} <span className="text-slate-400">· {e.payment}</span></span>
              <span className={`font-semibold ${e.type === 'given' ? 'text-red-600' : 'text-emerald-600'}`}>
                {e.type === 'given' ? '-' : '+'}{formatPKR(e.amount)}
              </span>
            </li>
          ))}
          {mine.length === 0 && <li className="text-sm text-slate-400">No entries yet.</li>}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 6: Add routes in `src/App.tsx`**

Add imports and routes:

```tsx
import Udhari from './pages/Udhari'
import PersonDetail from './pages/PersonDetail'
// ...
        <Route path="udhari" element={<Udhari />} />
        <Route path="udhari/:personId" element={<PersonDetail />} />
```

- [ ] **Step 7: Run both page tests**

Run: `npx vitest run Udhari PersonDetail`
Expected: PASS.

- [ ] **Step 8: Build gate + lint**

Run: `npm run build`
Run: `npm run lint`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Udhari.tsx src/pages/Udhari.test.tsx src/pages/PersonDetail.tsx src/pages/PersonDetail.test.tsx src/App.tsx
git commit -m "feat(phase3): udhari list + person-detail pages + routes"
```

---

## Task 9: Dashboard + Settings wiring

**Files:**
- Modify: `src/pages/Dashboard.tsx` (Total Worth, today's kharcha, Kharcha/Udhar quick-actions)
- Modify: `src/pages/Dashboard.test.tsx`
- Modify: `src/pages/Settings.tsx` (expense-category editor)
- Modify: `src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes (Dashboard): `summarizeExpenses`/`todaysExpenses`/`totalWorth` (summary), `udharTotals` (udhar), `selectTotalCash`.
- Consumes (Settings): `updateSettings` (already present).

- [ ] **Step 1: Write the failing Dashboard test**

Append to `src/pages/Dashboard.test.tsx`. Reuse the file's existing mount pattern (if it has a render helper, use it; otherwise render `<MemoryRouter><Dashboard /></MemoryRouter>` after `init`, like the other page tests). Add:

```typescript
it('shows Total Worth + today kharcha and links to kharcha + udhari', async () => {
  const base = useAppStore.getState().data!
  useAppStore.setState({
    data: {
      ...base,
      drawer: { 100: 10 },
      expenses: [{ id: 'e1', category: 'Bijli', amount: 200_00, payment: 'cash', walletId: null, createdAt: new Date().toISOString() }],
      persons: [{ id: 'p1', name: 'Ali' }],
      udharEntries: [{ id: 'u1', personId: 'p1', type: 'given', amount: 500_00, payment: 'cash', walletId: null, createdAt: new Date().toISOString() }],
    },
  })
  render(<MemoryRouter><Dashboard /></MemoryRouter>)
  expect(screen.getByText('Total Worth')).toBeInTheDocument()
  expect(screen.getByText('Rs 200')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /kharcha/i })).toHaveAttribute('href', '/kharcha')
  expect(screen.getByRole('link', { name: /udhar/i })).toHaveAttribute('href', '/udhari')
})
```

> Ensure `MemoryRouter`, `render`, and `screen` are imported in the file (the existing Dashboard tests already render it inside a router — match those imports).

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run Dashboard`
Expected: FAIL — no "Total Worth" / kharcha links yet.

- [ ] **Step 3: Wire `src/pages/Dashboard.tsx`**

Update the summary import line to include the new helpers and add the udhar import:

```tsx
import { summarize, todaysTransactions, summarizeExpenses, todaysExpenses, totalWorth } from '../domain/summary'
import { udharTotals } from '../domain/udhar'
```

Add slices + derived values after the existing `transactions`/`today` lines (inside the component, before `return`):

```tsx
  const expenses = useAppStore((s) => s.data?.expenses ?? [])
  const persons = useAppStore((s) => s.data?.persons ?? [])
  const udharEntries = useAppStore((s) => s.data?.udharEntries ?? [])
  const walletBalance = useMemo(() => wallets.reduce((sum, w) => sum + w.balance, 0), [wallets])
  const todayKharcha = useMemo(() => summarizeExpenses(todaysExpenses(expenses, new Date())).total, [expenses])
  const udhar = useMemo(() => udharTotals(udharEntries, persons), [udharEntries, persons])
  const worth = totalWorth(total, walletBalance, udhar.receivable, udhar.payable)
```

Add a Total Worth block inside the emerald hero `<section>`, right after the big/small grid `</div>`:

```tsx
          <div className="mt-3 rounded-lg bg-white/15 p-2">
            <div className="text-xs opacity-90">Total Worth</div>
            <div className="font-bold">{formatPKR(worth)}</div>
          </div>
```

Replace the placeholder Kharcha StatCard (currently `value={formatPKR(0)}`):

```tsx
          <StatCard label="Kharcha" value={formatPKR(todayKharcha)} accent="text-red-600" />
```

Replace the quick-actions `<section>` entirely with:

```tsx
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
        <Link to="/cash" className="rounded-xl bg-slate-200 py-3 text-center font-semibold">
          Cash &amp; Notes
        </Link>
        <Link to="/transactions" className="rounded-xl bg-slate-200 py-3 text-center font-semibold">
          Transactions
        </Link>
      </section>
```

- [ ] **Step 4: Run to confirm Dashboard passes**

Run: `npx vitest run Dashboard`
Expected: PASS.

- [ ] **Step 5: Write the failing Settings test**

Append to `src/pages/Settings.test.tsx`, matching the file's existing mount pattern (render `<Settings />`, inside a router if the existing tests do so). Add:

```typescript
it('adds an expense category', async () => {
  render(<Settings />)
  fireEvent.change(screen.getByLabelText(/new category/i), { target: { value: 'Internet' } })
  fireEvent.click(screen.getByRole('button', { name: /add category/i }))
  await waitFor(() => {
    expect(useAppStore.getState().data!.settings.expenseCategories).toContain('Internet')
  })
})
```

> Use the same imports (`render`, `screen`, `fireEvent`, `waitFor`) and store setup the existing Settings tests use. If those tests wrap `<Settings />` in a router, do the same here.

- [ ] **Step 6: Run to confirm failure**

Run: `npx vitest run Settings`
Expected: FAIL — no category controls.

- [ ] **Step 7: Add the category editor to `src/pages/Settings.tsx`**

Add a `newCategory` state next to the other `useState`s:

```tsx
  const [newCategory, setNewCategory] = useState('')
```

Add this `<section>` after the Wallets section:

```tsx
      <section className="space-y-2 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Expense Categories</h2>
        <ul className="space-y-1">
          {data.settings.expenseCategories.map((c) => (
            <li key={c} className="flex items-center justify-between">
              <span>{c}</span>
              <button
                onClick={() => updateSettings({ expenseCategories: safeData.settings.expenseCategories.filter((x) => x !== c) })}
                className="text-sm text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <label htmlFor="newCategory" className="block text-sm">New category</label>
        <div className="flex gap-2">
          <input id="newCategory" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="flex-1 rounded-lg border px-3 py-2" />
          <button
            onClick={() => {
              const name = newCategory.trim()
              if (!name || safeData.settings.expenseCategories.includes(name)) return
              updateSettings({ expenseCategories: [...safeData.settings.expenseCategories, name] })
              setNewCategory('')
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white"
          >
            Add category
          </button>
        </div>
      </section>
```

- [ ] **Step 8: Run to confirm Settings passes**

Run: `npx vitest run Settings`
Expected: PASS.

- [ ] **Step 9: Full suite + build + lint**

Run: `npm test`
Run: `npm run build`
Run: `npm run lint`
Expected: all clean.

- [ ] **Step 10: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx src/pages/Settings.tsx src/pages/Settings.test.tsx
git commit -m "feat(phase3): dashboard total-worth/kharcha + settings categories"
```

---

## Task 10: Whole-branch review, manual smoke, docs

**Files:**
- Modify: `CLAUDE.md`
- (review only): all Phase 3 files

- [ ] **Step 1: Full gate**

Run: `npm test`
Run: `npm run build`
Run: `npm run lint`
Expected: green across the board. If anything fails, fix before continuing.

- [ ] **Step 2: Cross-module golden-invariant check**

Add a temporary test (or extend `summary.test.ts`) that, from a known drawer, applies a cash transaction + cash kharcha + cash udhar given + cash repayment and asserts `totalCash(drawer) === Σ cashMovements.delta`. Run it, confirm PASS, then delete the throwaway (each module already covers this individually; this just guards the combination).

- [ ] **Step 3: Manual smoke (dev server)**

Run: `npm run dev`. In the browser: log in (PIN 1234) → add a cash Kharcha → confirm drawer drops on the Cash page and Dashboard "Kharcha" today rises → add a person in Udhari → open them → "Udhar diya" cash → confirm balance + drawer → "Wapsi li" → confirm balance returns → add a wallet-paid kharcha → confirm wallet balance drops, drawer unchanged. Verify Total Worth = cash + wallets + receivable − payable.

- [ ] **Step 4: Code review**

Use superpowers:requesting-code-review on the full Phase 3 diff. Per the CLAUDE.md lesson, reviewers must assert resulting `AppData` (balances, ledger, drawer), not just navigation. Address any blockers before merge.

- [ ] **Step 5: Update `CLAUDE.md`**

- Status line → "Phases 1, 2A, 2B, and 3 are complete on `main`."
- Architecture → `src/domain/`: add `expense.ts` and `udhar.ts` bullets.
- Note the widened `CashMovement.sourceType` (`'transaction' | 'adjustment' | 'kharcha' | 'udhar'`) and that **wallet-settled** kharcha/udhar create **no** cash movement (drawer untouched).
- Mention `settings.expenseCategories` and the `persons`/`udharEntries`/`expenses` arrays in `AppData`.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Phase 3 (Kharcha + Udhari) complete"
```

- [ ] **Step 7: Finish the branch**

Use superpowers:finishing-a-development-branch to decide merge/PR/cleanup.

---

## Self-Review (author checklist — completed)

**1. Spec coverage:**
- §5.5 Udhari Book (per-person ledger, running balance, totals, cash-linked give/repay) → Tasks 4, 5, 8. *Extended:* wallet settlement also supported (user decision).
- §5.6 Kharcha (amount, category, note, paid from cash; daily totals by category) → Tasks 2, 3, 6, 7, 9. *Extended:* wallet payment supported; categories editable in Settings (Task 9).
- §5.1 Dashboard (Total Worth, today's kharcha, Kharcha/Udhar quick-actions) → Task 9.
- §3.1 Golden invariant preserved across new cash sources → Tasks 2, 4 (one movement per cash settlement), Task 10 cross-check.
- §6 data model (persons, udhar_entries, expenses, cash_movements source types) → mapped onto the JSONB `AppData` blob (Task 1). *Intentional deviation, consistent with the existing app:* single JSONB row, not relational tables; no Postgres RPC — pure domain functions are the atomic unit and the repo saves the whole blob.
- **Deferred to Phase 4 (per build order §8):** Count & Verify, Reports, PWA install — not in this plan.

**2. Placeholder scan:** No `TBD`/`implement later`/vague-handling steps. Page-test mount helpers (Dashboard/Settings) defer to each file's existing pattern with an explicit fallback (`<MemoryRouter><Page /></MemoryRouter>` after `init`); every other step has complete code.

**3. Type consistency:** `PaymentMethod` defined once in `wallet.ts`, imported everywhere. `negateNotes` defined once in `cash.ts`. `ExpenseInput.notesOut` vs `UdharInput.notes` are deliberately different (expense is always outward; udhar direction depends on `type`). Store action signatures match their domain `*Input` `Omit<…, 'id' | 'createdAt'>` shapes. `CashMovement.sourceType` widened once in Task 1, used by both new modules. `addPerson` returns `Promise<string>` consistently between Task 5's interface and the page tests in Task 8.
