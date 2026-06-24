# PCO Deposit / Withdraw Guided Transaction Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-form New Transaction form with a guided deposit/withdraw model where the owner enters the business event (amount, commission, which channel carries the fee) and the app derives the exact wallet and cash movements, hard-blocking a save whose physical notes don't reconcile to the derived cash target.

**Architecture:** Add a pure `deriveMovements` helper to the domain that maps `(type, amount, commission, commissionMode)` to signed `{ walletDelta, cashDelta }`. `applyTransaction` becomes the enforcement point: for guided types it derives the movements, throws `CASH_MISMATCH` if the entered notes don't net to the derived cash target, and records the derived deltas; `'other'` keeps today's manual behaviour. Legacy `send`/`receive` rows are remapped to `deposit`/`withdraw` on load. The UI becomes a thin guided shell. Strict layering preserved: domain ← data ← store ← UI.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`), React 18 + React Router, Zustand v5, Tailwind v3, Vitest + Testing Library (jsdom), Vite.

## Global Constraints

Copied verbatim from the spec and CLAUDE.md — every task's requirements implicitly include these:

- **Integer paisa everywhere.** All money is integer paisa (`Paisa`). Never floating-point rupees in logic. `toPaisa()` on input, `formatPKR()` on display. Literals use the `5000_00` (= Rs 5000) underscore style.
- **Golden invariant:** `totalCash(drawer) === Σ cashMovements[].delta`. Every drawer change flows through a `CashMovement` carrying the exact per-denomination `notes`.
- **Domain is pure, immutable, deterministic.** Returns new objects, never mutates inputs, never generates its own `id`/`createdAt` — those are passed in. Store actions are the only place `crypto.randomUUID()` / `new Date().toISOString()` are called.
- **`verbatimModuleSyntax` ON** plus `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`. Every type-only import MUST be `import type { … }` (or inline `import { type X, y }`). Unused imports/vars fail the build.
- **`applyNoteDelta` throws `Error('NEGATIVE_NOTES')`** if any denomination would go negative. UI call sites MUST `catch` it. The new `CASH_MISMATCH` is caught the same way.
- **Zustand v5:** no store selector may return a fresh object/array (causes "Maximum update depth exceeded"). Derive such values in the component with `useMemo` over the raw slice.
- **`npm run build` (`tsc -b && vite build`) is the real type-check gate** — `tsc -b` type-checks `src/**` *including test files*. `npm test` (vitest) does NOT type-check. Intermediate tasks are verified with targeted `npx vitest run`; the **full `npm run build` is green only after Task 5** (the type-union change ripples across files that later tasks fix). Task 6 is the final build/lint/test gate. Run it before declaring done.

**Money model (validated with the owner; example: transfer Rs 1000, commission Rs 20; signs from the shop's view):**

| type | mode | cashDelta | walletDelta |
|---|---|---|---|
| `deposit` | `cash` | `+(amount + commission)` | `−amount` |
| `deposit` | `wallet` | `+amount` | `−(amount − commission)` |
| `withdraw` | `cash` | `−(amount − commission)` | `+amount` |
| `withdraw` | `wallet` | `−amount` | `+(amount + commission)` |
| `easyload` | (any) | `+amount` | `−amount` |
| `package` | (any) | `+amount` | `−amount` |
| `other` | — | caller supplies (manual) | caller supplies (manual) |

For every deposit/withdraw row, total worth rises by exactly `commission`. Easyload/package net to zero.

---

## File Structure

- `src/domain/transaction.ts` — **modify.** New `TransactionType` union + `CommissionMode`; `Transaction` gains `commissionMode`, `discount` becomes optional; `TransactionInput` gains `commissionMode`, drops `discount`, `walletDelta` becomes optional; add `deriveMovements`; rewrite `applyTransaction` as the enforcement point. `deleteTransaction` unchanged.
- `src/domain/transaction.test.ts` — **rewrite.** `deriveMovements` table; guided `applyTransaction` cases; `CASH_MISMATCH`; `other`; golden invariant; immutability; `deleteTransaction` reversal.
- `src/data/normalize.ts` — **modify.** Remap legacy `send`→`deposit`, `receive`→`withdraw`; back-fill `commissionMode: 'cash'`; preserve legacy `discount`.
- `src/data/normalize.test.ts` — **create.** Back-compat assertions.
- `src/domain/summary.ts` — **modify.** `DaySummary`/`walletStats` rename `sent`/`received` → `deposited`/`withdrawn`; bucket on `deposit`/`withdraw`; profit uses `discount ?? 0`.
- `src/domain/summary.test.ts` — **modify.** New bucket names, legacy-remapped rows, optional discount.
- `src/pages/Dashboard.tsx` — **modify.** Labels "Deposited"/"Withdrawn", fields `today.deposited`/`today.withdrawn`.
- `src/pages/Dashboard.test.tsx` — **modify.** Fixture `send`→`deposit`, drop `discount`, add `commissionMode`.
- `src/store/appStore.test.ts` — **modify.** Fixtures `send`/`other` → new shape (add `commissionMode`, drop `discount`).
- `src/pages/Transactions.tsx` — **modify.** `TYPE_LABEL` keys `deposit`/`withdraw`; `t.discount` → `(t.discount ?? 0)`.
- `src/pages/Transactions.test.tsx` — **modify.** Fixtures to new shape + labels.
- `src/pages/Cash.test.tsx` — **modify.** Fixture to new shape.
- `src/pages/NewTransaction.tsx` — **rewrite.** Unified guided form.
- `src/pages/NewTransaction.test.tsx` — **rewrite.** Guided-form behaviour.

`src/domain/wallet.ts` `profit(commission, discount)` is a generic helper and is **not** changed (still valid for legacy display). `src/data/types.ts` needs no change — `AppData.transactions: Transaction[]` follows the interface automatically.

---

## Task 1: Domain core — `deriveMovements`, data model, guided `applyTransaction`

**Files:**
- Modify: `src/domain/transaction.ts`
- Test: `src/domain/transaction.test.ts` (rewrite)

**Interfaces:**
- Consumes: `Paisa` (`./money`), `DrawerCounts`, `totalCash`, `applyNoteDelta` (`./cash`), `applyWalletDelta` (`./wallet`), `AppData` (`../data/types`), existing `mergeNoteDelta`.
- Produces (relied on by later tasks):
  - `type TransactionType = 'deposit' | 'withdraw' | 'easyload' | 'package' | 'other'`
  - `type CommissionMode = 'cash' | 'wallet'`
  - `interface Transaction` with `commissionMode: CommissionMode` and `discount?: Paisa`
  - `interface TransactionInput` with `commissionMode: CommissionMode`, optional `walletDelta?: Paisa`, no `discount`
  - `function deriveMovements(type: TransactionType, amount: Paisa, commission: Paisa, commissionMode: CommissionMode): { walletDelta: Paisa; cashDelta: Paisa }`
  - `applyTransaction(data: AppData, input: TransactionInput): AppData` — throws `Error('CASH_MISMATCH')` and `Error('NEGATIVE_NOTES')`
  - `deleteTransaction(data: AppData, transactionId: string): AppData` (unchanged)

- [ ] **Step 1: Write the failing tests** — replace the entire contents of `src/domain/transaction.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import {
  applyTransaction,
  deleteTransaction,
  deriveMovements,
  mergeNoteDelta,
  type TransactionInput,
} from './transaction'

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

// A guided deposit, commission in cash: customer gives 1020 cash, shop sends 1000 from wallet.
// cash +1020, wallet -1000, profit +20.
const depositCashInput: TransactionInput = {
  id: 't1',
  createdAt: '2026-06-24T10:00:00.000Z',
  type: 'deposit',
  walletId: 'jazzcash',
  amount: 1000_00,
  commission: 20_00,
  commissionMode: 'cash',
  notesIn: { 1000: 1, 20: 1 }, // 1020
  notesOut: {},
  customerName: 'Ali',
}

describe('mergeNoteDelta', () => {
  it('adds notesIn as positive and notesOut as negative', () => {
    expect(mergeNoteDelta({ 5000: 1, 100: 2 }, { 100: 1 })).toEqual({ 5000: 1, 100: 1 })
  })
  it('drops denominations whose net is zero', () => {
    expect(mergeNoteDelta({ 100: 2 }, { 100: 2 })).toEqual({})
  })
})

describe('deriveMovements', () => {
  it('deposit / cash: cash +(amount+commission), wallet -amount', () => {
    expect(deriveMovements('deposit', 1000_00, 20_00, 'cash')).toEqual({ cashDelta: 1020_00, walletDelta: -1000_00 })
  })
  it('deposit / wallet: cash +amount, wallet -(amount-commission)', () => {
    expect(deriveMovements('deposit', 1000_00, 20_00, 'wallet')).toEqual({ cashDelta: 1000_00, walletDelta: -980_00 })
  })
  it('withdraw / cash: cash -(amount-commission), wallet +amount', () => {
    expect(deriveMovements('withdraw', 1000_00, 20_00, 'cash')).toEqual({ cashDelta: -980_00, walletDelta: 1000_00 })
  })
  it('withdraw / wallet: cash -amount, wallet +(amount+commission)', () => {
    expect(deriveMovements('withdraw', 1000_00, 20_00, 'wallet')).toEqual({ cashDelta: -1000_00, walletDelta: 1020_00 })
  })
  it('easyload and package net to zero regardless of mode', () => {
    expect(deriveMovements('easyload', 500_00, 0, 'cash')).toEqual({ cashDelta: 500_00, walletDelta: -500_00 })
    expect(deriveMovements('package', 500_00, 0, 'wallet')).toEqual({ cashDelta: 500_00, walletDelta: -500_00 })
  })
  it('every deposit/withdraw case raises worth by exactly the commission', () => {
    for (const mode of ['cash', 'wallet'] as const) {
      const dep = deriveMovements('deposit', 1000_00, 20_00, mode)
      expect(dep.cashDelta + dep.walletDelta).toBe(20_00)
      const wd = deriveMovements('withdraw', 1000_00, 20_00, mode)
      expect(wd.cashDelta + wd.walletDelta).toBe(20_00)
    }
  })
})

describe('applyTransaction (guided)', () => {
  it('applies the derived wallet and cash deltas and records the transaction', () => {
    const next = applyTransaction(baseData(), depositCashInput)
    expect(next.wallets[0].balance).toBe(99000_00) // -1000
    expect(totalCash(next.drawer)).toBe(1020_00)   // +1020
    expect(next.transactions).toHaveLength(1)
    const t = next.transactions[0]
    expect(t.type).toBe('deposit')
    expect(t.walletDelta).toBe(-1000_00)
    expect(t.cashDelta).toBe(1020_00)
    expect(t.commission).toBe(20_00)
    expect(t.commissionMode).toBe('cash')
  })

  it('writes one transaction cash movement whose delta matches the drawer (golden invariant) and carries the note', () => {
    const input = { ...depositCashInput, note: 'Ali deposit' }
    const next = applyTransaction(baseData(), input)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].sourceType).toBe('transaction')
    expect(next.cashMovements[0].delta).toBe(1020_00)
    expect(next.cashMovements[0].note).toBe('Ali deposit')
    expect(totalCash(next.drawer)).toBe(next.cashMovements.reduce((s, m) => s + m.delta, 0))
  })

  it('deposit / wallet mode reconciles when notes net to +amount', () => {
    const input: TransactionInput = {
      ...depositCashInput, id: 't2', commissionMode: 'wallet', notesIn: { 1000: 1 }, notesOut: {},
    }
    const next = applyTransaction(baseData(), input)
    expect(next.wallets[0].balance).toBe(99020_00) // -980
    expect(totalCash(next.drawer)).toBe(1000_00)
  })

  it('withdraw / cash mode: customer sends 1000 to wallet, shop gives 980 cash', () => {
    const data = baseData()
    data.drawer = { 500: 1, 100: 4, 50: 1, 20: 1, 10: 1 } // 980 available to give as change
    const input: TransactionInput = {
      id: 'w2', createdAt: '2026-06-24T10:00:00.000Z', type: 'withdraw', walletId: 'jazzcash',
      amount: 1000_00, commission: 20_00, commissionMode: 'cash',
      notesIn: {}, notesOut: { 500: 1, 100: 4, 50: 1, 20: 1, 10: 1 }, // -980
    }
    const next = applyTransaction(data, input)
    expect(next.wallets[0].balance).toBe(101000_00) // +1000
    expect(totalCash(next.drawer)).toBe(0)          // -980 from 980
    expect(next.transactions[0].cashDelta).toBe(-980_00)
  })

  it('forces commission to 0 for easyload and ignores commissionMode', () => {
    const input: TransactionInput = {
      id: 'e1', createdAt: '2026-06-24T10:00:00.000Z', type: 'easyload', walletId: 'jazzcash',
      amount: 500_00, commission: 99_00, commissionMode: 'wallet',
      notesIn: { 500: 1 }, notesOut: {},
    }
    const next = applyTransaction(baseData(), input)
    expect(next.transactions[0].commission).toBe(0)
    expect(next.wallets[0].balance).toBe(99500_00) // -500
    expect(totalCash(next.drawer)).toBe(500_00)
  })

  it('throws CASH_MISMATCH when entered notes do not net to the derived target; state untouched', () => {
    const input: TransactionInput = { ...depositCashInput, id: 't3', notesIn: { 1000: 1 }, notesOut: {} } // 1000 ≠ 1020
    expect(() => applyTransaction(baseData(), input)).toThrow('CASH_MISMATCH')
  })

  it('still throws NEGATIVE_NOTES when change exceeds the drawer', () => {
    const input: TransactionInput = {
      id: 'w3', createdAt: '2026-06-24T10:00:00.000Z', type: 'withdraw', walletId: 'jazzcash',
      amount: 1000_00, commission: 20_00, commissionMode: 'cash',
      notesIn: {}, notesOut: { 500: 1, 100: 4, 50: 1, 20: 1, 10: 1 }, // -980 from an empty drawer
    }
    expect(() => applyTransaction(baseData(), input)).toThrow('NEGATIVE_NOTES')
  })

  it('does not mutate the input data', () => {
    const data = baseData()
    applyTransaction(data, depositCashInput)
    expect(data.transactions).toHaveLength(0)
    expect(data.wallets[0].balance).toBe(100000_00)
    expect(totalCash(data.drawer)).toBe(0)
  })
})

describe('applyTransaction (other = manual escape hatch)', () => {
  it('uses the supplied walletDelta and notes with no derivation or mismatch check', () => {
    const input: TransactionInput = {
      id: 'o1', createdAt: '2026-06-24T10:00:00.000Z', type: 'other', walletId: null, walletDelta: 0,
      amount: 1000_00, commission: 0, commissionMode: 'cash',
      notesIn: { 1000: 1 }, notesOut: {},
    }
    const next = applyTransaction(baseData(), input)
    expect(next.wallets[0].balance).toBe(100000_00) // untouched
    expect(totalCash(next.drawer)).toBe(1000_00)
    expect(next.transactions[0].cashDelta).toBe(1000_00)
  })
})

describe('deleteTransaction', () => {
  it('reverses a derived deposit exactly', () => {
    const after = applyTransaction(baseData(), depositCashInput)
    const reverted = deleteTransaction(after, 't1')
    expect(reverted.transactions).toHaveLength(0)
    expect(reverted.cashMovements).toHaveLength(0)
    expect(reverted.wallets[0].balance).toBe(100000_00)
    expect(totalCash(reverted.drawer)).toBe(0)
  })

  it('reverses a derived withdraw exactly', () => {
    const data = baseData()
    data.drawer = { 500: 1, 100: 4, 50: 1, 20: 1, 10: 1 } // 980
    const input: TransactionInput = {
      id: 'w9', createdAt: '2026-06-24T10:00:00.000Z', type: 'withdraw', walletId: 'jazzcash',
      amount: 1000_00, commission: 20_00, commissionMode: 'cash',
      notesIn: {}, notesOut: { 500: 1, 100: 4, 50: 1, 20: 1, 10: 1 },
    }
    const after = applyTransaction(data, input)
    const reverted = deleteTransaction(after, 'w9')
    expect(reverted.wallets[0].balance).toBe(100000_00)
    expect(totalCash(reverted.drawer)).toBe(980_00)
    expect(reverted.transactions).toHaveLength(0)
  })

  it('returns data unchanged when the id is unknown', () => {
    const after = applyTransaction(baseData(), depositCashInput)
    expect(deleteTransaction(after, 'nope').transactions).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Shop-Cash-Ledger && npx vitest run transaction`
Expected: FAIL — `deriveMovements` is not exported; `commissionMode`/`CASH_MISMATCH` not handled.

- [ ] **Step 3: Update the data model and add `deriveMovements`** — in `src/domain/transaction.ts`, replace the type/interface block (lines 7–48, from `export type TransactionType` through the end of `interface TransactionInput`) with:

```ts
export type TransactionType = 'deposit' | 'withdraw' | 'easyload' | 'package' | 'other'

export type CommissionMode = 'cash' | 'wallet'

export interface Transaction {
  id: string
  type: TransactionType
  walletId: string | null
  walletDelta: Paisa
  amount: Paisa
  commission: Paisa
  commissionMode: CommissionMode
  cashDelta: Paisa
  /** Legacy only; omitted on new transactions. */
  discount?: Paisa
  customerName?: string
  customerPhone?: string
  note?: string
  createdAt: string
}

export interface CashMovement {
  id: string
  sourceType: 'transaction' | 'adjustment' | 'kharcha' | 'udhar' | 'count'
  sourceId: string
  delta: Paisa
  notes: Record<number, number>
  note?: string
  createdAt: string
}

export interface TransactionInput {
  id: string
  createdAt: string
  type: TransactionType
  walletId: string | null
  amount: Paisa
  commission: Paisa
  commissionMode: CommissionMode
  notesIn: Record<number, number>
  notesOut: Record<number, number>
  /** Manual signed wallet delta — used ONLY by type 'other'. Ignored for guided types. */
  walletDelta?: Paisa
  customerName?: string
  customerPhone?: string
  note?: string
}

/**
 * Derive the signed wallet and cash movements for a guided transaction.
 * `amount` is the transfer amount; `commission` is the shop's fee. Signs are
 * from the shop's view. Pure/deterministic. For deposit/withdraw, total worth
 * rises by exactly `commission`; easyload/package net to zero. `other` is not
 * derived here — the caller supplies its deltas.
 */
export function deriveMovements(
  type: TransactionType,
  amount: Paisa,
  commission: Paisa,
  commissionMode: CommissionMode,
): { walletDelta: Paisa; cashDelta: Paisa } {
  switch (type) {
    case 'deposit':
      return commissionMode === 'cash'
        ? { cashDelta: amount + commission, walletDelta: -amount }
        : { cashDelta: amount, walletDelta: -(amount - commission) }
    case 'withdraw':
      return commissionMode === 'cash'
        ? { cashDelta: -(amount - commission), walletDelta: amount }
        : { cashDelta: -amount, walletDelta: amount + commission }
    case 'easyload':
    case 'package':
      return { cashDelta: amount, walletDelta: -amount }
    default:
      return { cashDelta: 0, walletDelta: 0 }
  }
}
```

(`CashMovement` is reproduced unchanged so the block stays contiguous; its definition is identical to before.)

- [ ] **Step 4: Rewrite `applyTransaction` as the enforcement point** — replace the existing `applyTransaction` function (the final function in the file, starting at its doc comment `/**\n * Apply a transaction…`) with:

```ts
/**
 * Apply a transaction to the app data, returning new data with the wallet,
 * drawer, transactions and cashMovements updated. Pure and immutable.
 *
 * Guided types (deposit/withdraw/easyload/package) derive their wallet and cash
 * deltas from `deriveMovements`; the entered notes MUST net to the derived cash
 * target or this throws Error('CASH_MISMATCH'). easyload/package force
 * commission to 0. Type 'other' is the manual escape hatch: it uses the
 * supplied `walletDelta` and notes with no derivation or reconciliation.
 * Throws Error('NEGATIVE_NOTES') if change given exceeds the drawer.
 */
export function applyTransaction(data: AppData, input: TransactionInput): AppData {
  const isGuided = input.type !== 'other'
  const commission: Paisa =
    input.type === 'easyload' || input.type === 'package' ? 0 : input.commission

  const actual: Paisa = totalCash(input.notesIn) - totalCash(input.notesOut)

  let walletDelta: Paisa
  let cashDelta: Paisa
  if (isGuided) {
    const derived = deriveMovements(input.type, input.amount, commission, input.commissionMode)
    walletDelta = derived.walletDelta
    cashDelta = derived.cashDelta
    if (actual !== cashDelta) throw new Error('CASH_MISMATCH')
  } else {
    walletDelta = input.walletDelta ?? 0
    cashDelta = actual
  }

  const noteDelta = mergeNoteDelta(input.notesIn, input.notesOut)
  const drawer: DrawerCounts = applyNoteDelta(data.drawer, noteDelta)

  const wallets =
    input.walletId === null || walletDelta === 0
      ? data.wallets
      : data.wallets.map((w) =>
          w.id === input.walletId ? applyWalletDelta(w, walletDelta) : w,
        )

  const transaction: Transaction = {
    id: input.id,
    type: input.type,
    walletId: input.walletId,
    walletDelta,
    amount: input.amount,
    commission,
    commissionMode: input.commissionMode,
    cashDelta,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    note: input.note,
    createdAt: input.createdAt,
  }

  const cashMovements = [...data.cashMovements]
  if (cashDelta !== 0 || Object.keys(noteDelta).length > 0) {
    cashMovements.unshift({
      id: `${input.id}-c`,
      sourceType: 'transaction',
      sourceId: input.id,
      delta: cashDelta,
      notes: noteDelta,
      note: input.note,
      createdAt: input.createdAt,
    })
  }

  return {
    ...data,
    wallets,
    drawer,
    transactions: [transaction, ...data.transactions],
    cashMovements,
  }
}
```

`deleteTransaction` and `mergeNoteDelta` are unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd Shop-Cash-Ledger && npx vitest run transaction`
Expected: PASS (all `deriveMovements`, `applyTransaction`, and `deleteTransaction` tests green).

- [ ] **Step 6: Commit**

```bash
git add Shop-Cash-Ledger/src/domain/transaction.ts Shop-Cash-Ledger/src/domain/transaction.test.ts
git commit -m "feat(domain): guided deposit/withdraw money model with deriveMovements + CASH_MISMATCH enforcement"
```

---

## Task 2: Back-compat — remap legacy `send`/`receive` on load

**Files:**
- Modify: `src/data/normalize.ts`
- Test: `src/data/normalize.test.ts` (create)

**Interfaces:**
- Consumes: `AppData` (`./types`), `TransactionType` (`../domain/transaction`), `DEFAULT_EXPENSE_CATEGORIES` (`../domain/expense`).
- Produces: `normalizeAppData(data: AppData): AppData` — legacy `send`→`deposit`, `receive`→`withdraw`; `commissionMode` back-filled to `'cash'`; `discount` preserved; existing array back-fills unchanged.

- [ ] **Step 1: Write the failing test** — create `src/data/normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { AppData } from './types'
import { normalizeAppData } from './normalize'

function rawData(transactions: unknown[]): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: [], expenseCategories: ['Bijli'] },
    wallets: [],
    drawer: {},
    // legacy rows may carry off-union strings and lack commissionMode
    transactions: transactions as AppData['transactions'],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}

describe('normalizeAppData — transaction back-compat', () => {
  it('remaps legacy send → deposit and receive → withdraw (label only)', () => {
    const data = rawData([
      { id: 'a', type: 'send', walletId: null, walletDelta: -100, amount: 100, commission: 0, cashDelta: 100, createdAt: 'x' },
      { id: 'b', type: 'receive', walletId: null, walletDelta: 100, amount: 100, commission: 0, cashDelta: -100, createdAt: 'x' },
    ])
    const out = normalizeAppData(data)
    expect(out.transactions[0].type).toBe('deposit')
    expect(out.transactions[1].type).toBe('withdraw')
    // balances/deltas untouched
    expect(out.transactions[0].walletDelta).toBe(-100)
    expect(out.transactions[1].cashDelta).toBe(-100)
  })

  it('back-fills commissionMode to cash when missing and preserves legacy discount', () => {
    const data = rawData([
      { id: 'c', type: 'send', walletId: null, walletDelta: 0, amount: 100, commission: 5, discount: 2, cashDelta: 100, createdAt: 'x' },
    ])
    const out = normalizeAppData(data)
    expect(out.transactions[0].commissionMode).toBe('cash')
    expect(out.transactions[0].discount).toBe(2)
  })

  it('leaves an already-migrated transaction unchanged', () => {
    const data = rawData([
      { id: 'd', type: 'deposit', walletId: null, walletDelta: -100, amount: 100, commission: 5, commissionMode: 'wallet', cashDelta: 100, createdAt: 'x' },
    ])
    const out = normalizeAppData(data)
    expect(out.transactions[0].type).toBe('deposit')
    expect(out.transactions[0].commissionMode).toBe('wallet')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Shop-Cash-Ledger && npx vitest run normalize`
Expected: FAIL — `type` still `'send'`, `commissionMode` undefined.

- [ ] **Step 3: Implement the remap** — replace the entire contents of `src/data/normalize.ts` with:

```ts
import type { AppData } from './types'
import type { TransactionType } from '../domain/transaction'
import { DEFAULT_EXPENSE_CATEGORIES } from '../domain/expense'

const LEGACY_TYPE: Record<string, TransactionType> = {
  send: 'deposit',
  receive: 'withdraw',
}

/** Fill in fields that old persisted data may lack, and remap legacy transaction
 *  types to the guided model (label only — stored deltas and notes are untouched). */
export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    settings: {
      ...data.settings,
      expenseCategories: data.settings.expenseCategories ?? [...DEFAULT_EXPENSE_CATEGORIES],
    },
    transactions: (data.transactions ?? []).map((t) => ({
      ...t,
      type: LEGACY_TYPE[t.type as string] ?? t.type,
      commissionMode: t.commissionMode ?? 'cash',
    })),
    cashMovements: data.cashMovements ?? [],
    persons: data.persons ?? [],
    udharEntries: data.udharEntries ?? [],
    expenses: data.expenses ?? [],
    counts: data.counts ?? [],
    adjustments: data.adjustments ?? [],
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Shop-Cash-Ledger && npx vitest run normalize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Shop-Cash-Ledger/src/data/normalize.ts Shop-Cash-Ledger/src/data/normalize.test.ts
git commit -m "feat(data): remap legacy send/receive to deposit/withdraw and back-fill commissionMode on load"
```

---

## Task 3: Summary buckets + Dashboard labels

**Files:**
- Modify: `src/domain/summary.ts`
- Test: `src/domain/summary.test.ts`
- Modify: `src/pages/Dashboard.tsx`
- Test: `src/pages/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `Transaction` (`./transaction`).
- Produces:
  - `interface DaySummary { count; deposited; withdrawn; commission; discount; profit }`
  - `summarize(transactions): DaySummary` — buckets `deposit`→`deposited`, `withdraw`→`withdrawn`; `profit = Σ commission − Σ (discount ?? 0)`
  - `walletStats(transactions, walletId): { deposited; withdrawn; commission; discount }`

- [ ] **Step 1: Update the failing tests** — in `src/domain/summary.test.ts` apply these edits:
  - The `tx` fixture factory (line ~11) uses `type: 'send'` and `discount: 0` — change its default to `type: 'deposit'` and keep `discount: 0` (discount stays a legacy field on the fixture).
  - In the "totals" test (lines ~17–27): change `tx({ type: 'send', amount: 5000_00, commission: 50_00, discount: 0 })` → `tx({ type: 'deposit', amount: 5000_00, commission: 50_00 })`; change `tx({ type: 'receive', amount: 2000_00, commission: 20_00, discount: 5_00 })` → `tx({ type: 'withdraw', amount: 2000_00, commission: 20_00, discount: 5_00 })`; replace `expect(s.sent).toBe(5000_00)` → `expect(s.deposited).toBe(5000_00)` and `expect(s.received).toBe(2000_00)` → `expect(s.withdrawn).toBe(2000_00)`. Leave the `discount`/`profit` assertions as-is.
  - Add this test inside the `summarize` describe block:

```ts
  it('still counts legacy-remapped rows that lack a discount field', () => {
    const s = summarize([
      tx({ type: 'deposit', amount: 1000_00, commission: 10_00 }),
      tx({ type: 'withdraw', amount: 500_00, commission: 5_00 }),
    ])
    expect(s.deposited).toBe(1000_00)
    expect(s.withdrawn).toBe(500_00)
    expect(s.profit).toBe(15_00)
  })
```

  - In the `walletStats` test (lines ~65–75): change the three fixtures' `type: 'send'`/`'receive'` to `'deposit'`/`'withdraw'` respectively, and replace `expect(s.sent)` → `expect(s.deposited)` and `expect(s.received)` → `expect(s.withdrawn)`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Shop-Cash-Ledger && npx vitest run summary`
Expected: FAIL — `s.deposited`/`s.withdrawn` are `undefined`.

- [ ] **Step 3: Update `summary.ts`** — replace `DaySummary` (lines 5–12), `summarize` (lines 14–25), and `walletStats` (lines 50–63) with:

```ts
export interface DaySummary {
  count: number
  deposited: Paisa
  withdrawn: Paisa
  commission: Paisa
  discount: Paisa
  profit: Paisa
}

export function summarize(transactions: Transaction[]): DaySummary {
  const s: DaySummary = { count: 0, deposited: 0, withdrawn: 0, commission: 0, discount: 0, profit: 0 }
  for (const t of transactions) {
    s.count += 1
    if (t.type === 'deposit') s.deposited += t.amount
    if (t.type === 'withdraw') s.withdrawn += t.amount
    s.commission += t.commission
    s.discount += t.discount ?? 0
  }
  s.profit = s.commission - s.discount
  return s
}
```

and

```ts
export function walletStats(
  transactions: Transaction[],
  walletId: string,
): { deposited: Paisa; withdrawn: Paisa; commission: Paisa; discount: Paisa } {
  const s = { deposited: 0, withdrawn: 0, commission: 0, discount: 0 }
  for (const t of transactions) {
    if (t.walletId !== walletId) continue
    if (t.type === 'deposit') s.deposited += t.amount
    if (t.type === 'withdraw') s.withdrawn += t.amount
    s.commission += t.commission
    s.discount += t.discount ?? 0
  }
  return s
}
```

- [ ] **Step 4: Update Dashboard labels** — in `src/pages/Dashboard.tsx`, replace lines 72–73:

```tsx
          <StatCard label="Deposited" value={formatPKR(today.deposited)} />
          <StatCard label="Withdrawn" value={formatPKR(today.withdrawn)} />
```

- [ ] **Step 5: Update the Dashboard test fixture** — in `src/pages/Dashboard.test.tsx`, lines 43–44, replace the `addTransaction` call body with the guided shape (the test only asserts profit `Rs 30`, so notes must reconcile to the deposit/cash target `1000 + 30 = 1030`):

```tsx
      type: 'deposit', walletId: 'easypaisa', amount: 1000_00,
      commission: 30_00, commissionMode: 'cash', notesIn: { 1000: 1, 20: 1, 10: 1 }, notesOut: {},
```

Note: notes net to `1030_00` using denominations that exist in `DEFAULT_DENOMINATIONS` (1000 + 20 + 10). If `DEFAULT_DENOMINATIONS` happens to include a `30` note, `{ 1000: 1, 30: 1 }` is equivalent — verify against `src/domain/denominations.ts` before running.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd Shop-Cash-Ledger && npx vitest run summary Dashboard`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add Shop-Cash-Ledger/src/domain/summary.ts Shop-Cash-Ledger/src/domain/summary.test.ts Shop-Cash-Ledger/src/pages/Dashboard.tsx Shop-Cash-Ledger/src/pages/Dashboard.test.tsx
git commit -m "feat(summary): rename sent/received buckets to deposited/withdrawn and update Dashboard"
```

---

## Task 4: Migrate remaining consumers — store test, Transactions list, Cash test

**Files:**
- Modify: `src/store/appStore.test.ts`
- Modify: `src/pages/Transactions.tsx`
- Test: `src/pages/Transactions.test.tsx`
- Test: `src/pages/Cash.test.tsx`

**Interfaces:**
- Consumes: `addTransaction(input: Omit<TransactionInput, 'id' | 'createdAt'>)` (now requires `commissionMode`, no `discount`), `TransactionType` labels.
- Produces: no new exports — brings the remaining call sites onto the new model so the build can go green.

The store action `addTransaction` itself needs **no code change** (it spreads the input and its param type follows `TransactionInput` automatically). Only its tests and the list display reference the old shape.

- [ ] **Step 1: Update the store test fixtures** — in `src/store/appStore.test.ts`:
  - In the `addTransaction` test (lines ~70–80) replace the call body with:

```ts
    await useAppStore.getState().addTransaction({
      type: 'deposit',
      walletId: 'jazzcash',
      amount: 1000_00,
      commission: 20_00,
      commissionMode: 'cash',
      notesIn: { 1000: 1, 20: 1 },
      notesOut: {},
      customerName: 'Ali',
    })
```

  and update the wallet assertion to the derived deposit. The seed JazzCash balance is **not** `100000_00` — read it first:

  > Before running, read the JazzCash seed balance from `src/data/seed.ts` (or inspect `useAppStore.getState().data` in the test). Set the expectation to `seedBalance - 1000_00`, i.e. replace `expect(data.wallets.find((w) => w.id === 'jazzcash')!.balance).toBe(-5000_00)` with `.toBe(seedBalance - 1000_00)` using the literal value you read. Keep the `transactions).toHaveLength(1)`, `id).toBeTruthy()`, and `reloaded.transactions).toHaveLength(1)` assertions.

  - In the `deleteTransaction` test (lines ~94–103) replace the `addTransaction` body with the `other` shape:

```ts
    await useAppStore.getState().addTransaction({
      type: 'other',
      walletId: null,
      walletDelta: 0,
      amount: 1000_00,
      commission: 0,
      commissionMode: 'cash',
      notesIn: { 1000: 1 },
      notesOut: {},
    })
```

- [ ] **Step 2: Update the Transactions list display** — in `src/pages/Transactions.tsx`:
  - Line 8 (`TYPE_LABEL`): replace with

```ts
  easyload: 'Easyload', deposit: 'Deposit', withdraw: 'Withdraw', package: 'Package', other: 'Other',
```

  - Line 59 (`Profit {formatPKR(t.commission - t.discount)}`): replace `t.commission - t.discount` with `t.commission - (t.discount ?? 0)`.

- [ ] **Step 3: Update the Transactions test fixtures** — in `src/pages/Transactions.test.tsx`, lines 15–20, change the two fixtures to reconciling deposits (this test asserts list rendering — customer names and labels — so two simple deposits keep every assertion valid):

```tsx
    type: 'deposit', walletId: 'jazzcash', amount: 5000_00,
    commission: 50_00, commissionMode: 'cash', notesIn: { 5000: 1, 50: 1 }, notesOut: {}, customerName: 'Ali Khan',
```

```tsx
    type: 'deposit', walletId: 'easypaisa', amount: 2000_00,
    commission: 20_00, commissionMode: 'cash', notesIn: { 2000: 1, 20: 1 }, notesOut: {}, customerName: 'Bilal',
```

  After editing, grep this file for the literal strings `Send`/`Receive`/`receive`; if any assertion checks for them, change it to `Deposit`/`Withdraw` accordingly. (If a test specifically needs a withdraw row, use `type: 'withdraw', commissionMode: 'cash'` with `notesOut` giving cash and a pre-seeded drawer — but the simplest passing change is two deposits as above.)

- [ ] **Step 4: Update the Cash test fixture** — in `src/pages/Cash.test.tsx`, lines 14–15, replace with the new shape:

```tsx
    type: 'deposit', walletId: 'jazzcash', amount: 9950_00,
    commission: 50_00, commissionMode: 'cash', notesIn: { 5000: 2 }, notesOut: {},
```

  This nets cash to `9950 + 50 = 10000 = {5000:2}` so the existing drawer/total assertions (two Rs 5000 notes) still hold. If the test asserts a specific `amount` or wallet delta, update them to `9950_00` / `-9950_00`; if it only asserts drawer cash totals, no further change is needed.

- [ ] **Step 5: Run the affected tests**

Run: `cd Shop-Cash-Ledger && npx vitest run appStore Transactions Cash`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Shop-Cash-Ledger/src/store/appStore.test.ts Shop-Cash-Ledger/src/pages/Transactions.tsx Shop-Cash-Ledger/src/pages/Transactions.test.tsx Shop-Cash-Ledger/src/pages/Cash.test.tsx
git commit -m "refactor: migrate store/list/cash tests and Transactions labels to the guided model"
```

---

## Task 5: NewTransaction guided form rewrite

**Files:**
- Modify: `src/pages/NewTransaction.tsx` (rewrite)
- Test: `src/pages/NewTransaction.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `useAppStore` (`addTransaction`, `data`), `TransactionType`, `CommissionMode`, `deriveMovements` (`../domain/transaction`), `toPaisa`, `formatPKR` (`../domain/money`), `totalCash` (`../domain/cash`), `NotePicker`.
- Produces: the guided New Transaction page (no exports consumed elsewhere).

- [ ] **Step 1: Write the failing tests** — replace the entire contents of `src/pages/NewTransaction.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import NewTransaction from './NewTransaction'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(async () => {
  mockNavigate.mockClear()
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
})

function renderPage() {
  return render(<BrowserRouter><NewTransaction /></BrowserRouter>)
}

describe('NewTransaction — guided form', () => {
  it('shows the five transaction types', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /^deposit$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^withdraw$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^easyload$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^package$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^other$/i })).toBeInTheDocument()
  })

  it('Deposit shows the commission-mode toggle and a derived target', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^deposit$/i }))
    expect(screen.getByRole('button', { name: /fee in cash/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fee in wallet/i })).toBeInTheDocument()
    // Enter amount 1000, commission 20 → target drawer +1020
    const [amountInput, commissionInput] = screen.getAllByRole('spinbutton')
    fireEvent.change(amountInput, { target: { value: '1000' } })
    fireEvent.change(commissionInput, { target: { value: '20' } })
    expect(screen.getByTestId('derived-target')).toHaveTextContent(/1,020/)
  })

  it('disables Confirm until the entered notes net to the target', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^deposit$/i }))
    const [amountInput, commissionInput] = screen.getAllByRole('spinbutton')
    fireEvent.change(amountInput, { target: { value: '1000' } })
    fireEvent.change(commissionInput, { target: { value: '20' } })

    const confirm = screen.getByRole('button', { name: /confirm|submit|save/i })
    expect(confirm).toBeDisabled()

    // Add Rs 1000 + Rs 20 received = 1020 net
    const received = screen.getByText(/notes received/i).closest('.rounded-xl') as HTMLElement
    fireEvent.click(within(received).getByRole('button', { name: /add Rs 1000/i }))
    fireEvent.click(within(received).getByRole('button', { name: /add Rs 20/i }))
    await waitFor(() => expect(confirm).not.toBeDisabled())
  })

  it('submits a valid deposit and writes the derived AppData', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^deposit$/i }))

    const walletSelect = screen.getByLabelText(/^wallet$/i) as HTMLSelectElement
    fireEvent.change(walletSelect, { target: { value: walletSelect.options[1].value } })
    const walletId = walletSelect.options[1].value
    const before = useAppStore.getState().data!.wallets.find((w) => w.id === walletId)!.balance

    const [amountInput, commissionInput] = screen.getAllByRole('spinbutton')
    fireEvent.change(amountInput, { target: { value: '1000' } })
    fireEvent.change(commissionInput, { target: { value: '20' } })

    const received = screen.getByText(/notes received/i).closest('.rounded-xl') as HTMLElement
    fireEvent.click(within(received).getByRole('button', { name: /add Rs 1000/i }))
    fireEvent.click(within(received).getByRole('button', { name: /add Rs 20/i }))

    fireEvent.click(screen.getByRole('button', { name: /confirm|submit|save/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))

    const after = useAppStore.getState().data!
    const tx = after.transactions[0]
    expect(tx.type).toBe('deposit')
    expect(tx.walletDelta).toBe(-1000_00)
    expect(tx.cashDelta).toBe(1020_00)
    expect(tx.commission).toBe(20_00)
    expect(tx.commissionMode).toBe('cash')
    expect(after.wallets.find((w) => w.id === walletId)!.balance).toBe(before - 1000_00)
    expect(after.cashMovements[0].delta).toBe(1020_00)
  })

  it('Easyload hides the commission controls', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^easyload$/i }))
    expect(screen.queryByRole('button', { name: /fee in cash/i })).not.toBeInTheDocument()
  })

  it('Other keeps the manual wallet-direction flow', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^other$/i }))
    expect(screen.getByRole('button', { name: /money out/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /money in/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd Shop-Cash-Ledger && npx vitest run NewTransaction`
Expected: FAIL — the current form has no commission-mode toggle, derived target, or net-vs-target gating.

- [ ] **Step 3: Rewrite the page** — replace the entire contents of `src/pages/NewTransaction.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { TransactionType, CommissionMode } from '../domain/transaction'
import { deriveMovements } from '../domain/transaction'
import { toPaisa, formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import NotePicker from '../components/NotePicker'

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw' },
  { value: 'easyload', label: 'Easyload' },
  { value: 'package', label: 'Package' },
  { value: 'other', label: 'Other' },
]

/** Which way the chosen wallet moves for 'other': out of it, into it, or untouched. */
type WalletDir = 'none' | 'out' | 'in'

function signed(p: number): string {
  return `${p >= 0 ? '+' : ''}${formatPKR(p)}`
}

export default function NewTransaction() {
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const addTransaction = useAppStore((s) => s.addTransaction)

  const [type, setType] = useState<TransactionType>('deposit')
  const [walletId, setWalletId] = useState<string | null>(data?.wallets[0]?.id ?? null)
  const [amount, setAmount] = useState<number>(0)
  const [commission, setCommission] = useState<number>(0)
  const [commissionMode, setCommissionMode] = useState<CommissionMode>('cash')
  const [dir, setDir] = useState<WalletDir>('none') // only used by 'other'
  const [notesIn, setNotesIn] = useState<Record<number, number>>({})
  const [notesOut, setNotesOut] = useState<Record<number, number>>({})
  const [customerName, setCustomerName] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGuided = type !== 'other'
  const showCommission = type === 'deposit' || type === 'withdraw'

  const amountPaisa = toPaisa(amount)
  const commissionPaisa = showCommission ? toPaisa(commission) : 0

  const actualNet = useMemo(() => totalCash(notesIn) - totalCash(notesOut), [notesIn, notesOut])

  const derived = useMemo(
    () => deriveMovements(type, amountPaisa, commissionPaisa, commissionMode),
    [type, amountPaisa, commissionPaisa, commissionMode],
  )

  // For 'other': manual signed wallet delta from the direction toggle.
  const otherWalletDelta = dir === 'out' ? -amountPaisa : dir === 'in' ? amountPaisa : 0
  const useOtherWallet = dir !== 'none' && !!walletId

  const wallet = data?.wallets.find((w) => w.id === walletId)
  const matches = actualNet === derived.cashDelta
  const isValid = isGuided
    ? amountPaisa > 0 && matches
    : amountPaisa > 0

  if (!data) return <div className="p-8">Loading…</div>
  const denominations = data.settings.denominations

  function pickType(t: TransactionType) {
    setType(t)
    if (t === 'easyload' || t === 'package') setCommission(0)
    if (t === 'other') setDir('out')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    try {
      if (isGuided) {
        await addTransaction({
          type,
          walletId,
          amount: amountPaisa,
          commission: commissionPaisa,
          commissionMode,
          notesIn,
          notesOut,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          note: note || undefined,
        })
      } else {
        await addTransaction({
          type: 'other',
          walletId: useOtherWallet ? walletId : null,
          walletDelta: otherWalletDelta,
          amount: amountPaisa,
          commission: 0,
          commissionMode: 'cash',
          notesIn,
          notesOut,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          note: note || undefined,
        })
      }
      navigate('/')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(
        msg === 'CASH_MISMATCH'
          ? `Notes don't match the transaction — off by ${formatPKR(Math.abs(derived.cashDelta - actualNet))}.`
          : msg === 'NEGATIVE_NOTES'
            ? 'Change given exceeds the cash in the drawer. Adjust the notes and try again.'
            : 'Could not save the transaction. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">New Transaction</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transaction Type */}
        <div className="rounded-xl border bg-white p-3">
          <label className="mb-2 block text-sm font-semibold text-slate-600">Transaction Type</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => pickType(t.value)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  type === t.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wallet */}
        <div className="space-y-2 rounded-xl border bg-white p-3">
          <label htmlFor="wallet" className="block text-sm font-semibold text-slate-600">Wallet</label>
          <select
            id="wallet"
            value={walletId || ''}
            onChange={(e) => setWalletId(e.target.value || null)}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="">No Wallet</option>
            {data.wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({formatPKR(w.balance)})
              </option>
            ))}
          </select>

          {/* Manual direction — only for 'other' */}
          {type === 'other' && (
            <div className="flex gap-2">
              {(['out', 'in', 'none'] as WalletDir[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={d === 'out' ? 'wallet money out' : d === 'in' ? 'wallet money in' : 'wallet no change'}
                  onClick={() => setDir(d)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                    dir === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {d === 'out' ? 'Money OUT' : d === 'in' ? 'Money IN' : 'No change'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Amount + Commission */}
        <div className={`grid gap-2 ${showCommission ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div className="rounded-xl border bg-white p-3">
            <label htmlFor="amount" className="mb-2 block text-sm font-semibold text-slate-600">Amount (Rs)</label>
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-lg border px-2 py-1 text-right"
              min="0"
              step="0.01"
            />
          </div>
          {showCommission && (
            <div className="rounded-xl border bg-white p-3">
              <label htmlFor="commission" className="mb-2 block text-sm font-semibold text-slate-600">Commission (Rs)</label>
              <input
                id="commission"
                type="number"
                value={commission}
                onChange={(e) => setCommission(Number(e.target.value))}
                className="w-full rounded-lg border px-2 py-1 text-right"
                min="0"
                step="0.01"
              />
            </div>
          )}
        </div>

        {/* Commission mode toggle */}
        {showCommission && (
          <div className="rounded-xl border bg-white p-3">
            <label className="mb-2 block text-sm font-semibold text-slate-600">Commission carried in</label>
            <div className="flex gap-2">
              {(['cash', 'wallet'] as CommissionMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCommissionMode(m)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                    commissionMode === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {m === 'cash' ? 'Fee in cash' : 'Fee in wallet'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Derived target — guided types only */}
        {isGuided && (
          <div data-testid="derived-target" className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
            <div>
              Drawer should go <strong>{signed(derived.cashDelta)}</strong>
              {wallet && (
                <>
                  {', '}{wallet.name} <strong>{signed(derived.walletDelta)}</strong>
                </>
              )}
              {showCommission && <>{', profit '}<strong>{signed(commissionPaisa)}</strong></>}
            </div>
            <div className={matches ? 'text-emerald-600' : 'text-red-600'}>
              Net entered: {signed(actualNet)} {matches ? '✓ matches' : `(target ${signed(derived.cashDelta)})`}
            </div>
          </div>
        )}

        {/* Notes Received */}
        <NotePicker label="Notes Received" denominations={denominations} counts={notesIn} onChange={setNotesIn} />

        {/* Change Given */}
        <NotePicker label="Change Given" denominations={denominations} counts={notesOut} onChange={setNotesOut} />

        {/* Customer */}
        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="customerName" className="mb-2 block text-sm font-semibold text-slate-600">Customer Name (optional)</label>
          <input
            id="customerName"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., Ali, Shop Name"
          />
        </div>
        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="customerPhone" className="mb-2 block text-sm font-semibold text-slate-600">Phone (optional)</label>
          <input
            id="customerPhone"
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., 03001234567"
          />
        </div>
        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="note" className="mb-2 block text-sm font-semibold text-slate-600">Note (optional)</label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., Rush order, Special request"
            rows={3}
          />
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => navigate('/')} className="rounded-xl bg-slate-200 py-3 font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || loading}
            className={`rounded-xl py-3 font-semibold text-white ${
              isValid && !loading ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd Shop-Cash-Ledger && npx vitest run NewTransaction`
Expected: PASS. (If the `add Rs 20` / `add Rs 1000` button text differs from `NotePicker`'s actual `aria-label`, read `src/components/NotePicker.tsx` and match the exact label text in the test.)

- [ ] **Step 5: Commit**

```bash
git add Shop-Cash-Ledger/src/pages/NewTransaction.tsx Shop-Cash-Ledger/src/pages/NewTransaction.test.tsx
git commit -m "feat(ui): guided deposit/withdraw New Transaction form with derived target and net-vs-target gating"
```

---

## Task 6: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Type-check + build**

Run: `cd Shop-Cash-Ledger && npm run build`
Expected: PASS (no TypeScript errors). If a stray `discount`, `sent`/`received`, or `send`/`receive` reference remains, the error names the file and line — fix it to the new model and re-run.

- [ ] **Step 2: Lint**

Run: `cd Shop-Cash-Ledger && npm run lint`
Expected: PASS (no unused imports/vars — e.g. remove any leftover `discount` state or unused import that the rewrite left behind).

- [ ] **Step 3: Full test suite**

Run: `cd Shop-Cash-Ledger && npm test`
Expected: PASS (all files green).

- [ ] **Step 4: Commit any verification fixes**

```bash
git add -A
git commit -m "chore: verification fixes for deposit/withdraw redesign (build + lint + tests green)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec requirement | Task |
|---|---|
| `CommissionMode` type | Task 1 |
| `TransactionType` → 5 values | Task 1 |
| `Transaction` gains `commissionMode`, `discount?` optional | Task 1 |
| `TransactionInput` gains `commissionMode`, drops `discount`, `walletDelta?` optional | Task 1 |
| `deriveMovements` (all six rows) | Task 1 |
| `applyTransaction` enforcement + `CASH_MISMATCH` | Task 1 |
| Easyload/package force commission 0 | Task 1 |
| Note copied onto `CashMovement.note` | Task 1 |
| Golden invariant holds for guided | Task 1 (tests) |
| `deleteTransaction` reversal for derived deposit/withdraw | Task 1 (tests) |
| Back-compat `send`→`deposit`, `receive`→`withdraw`, back-fill `commissionMode`, preserve `discount` | Task 2 |
| Summary `sent`/`received` → `deposited`/`withdrawn`; profit = Σ commission − Σ(discount ?? 0) | Task 3 |
| `walletStats` rename | Task 3 |
| Dashboard labels Deposited/Withdrawn | Task 3 |
| Store `addTransaction` surfaces `CASH_MISMATCH`/`NEGATIVE_NOTES` (no code change; tests) | Task 4 |
| Transactions list labels | Task 4 |
| UI guided form: type selector, mode toggle, derived target, net-vs-target gating, Easyload hides commission, Other manual, error messages, navigate to `/` | Task 5 |
| Constraints (paisa, build gate, lint) | Task 6 |

**2. Placeholder scan:** No `TBD`/`TODO`/"handle edge cases" — every code step has full content. The only conditional guidance (Task 3 Step 5 denominations; Task 4 Step 1 seed balance / Step 3 fixtures; Task 5 Step 4 NotePicker label) is an explicit "verify-then-pick" instruction with the concrete value to read named, not a placeholder.

**3. Type consistency:** `deriveMovements` signature, `CommissionMode`, `TransactionType`, `Transaction.commissionMode`, `DaySummary.deposited`/`withdrawn`, and the `addTransaction` input shape are used identically across Tasks 1–5. `discount` is optional everywhere it survives (`Transaction.discount?`, summary `t.discount ?? 0`, Transactions `t.discount ?? 0`).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-24-pco-deposit-withdraw-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
