# PCO Deposit / Withdraw Guided Transaction Redesign — Design Spec

**Date:** 2026-06-24
**Status:** Approved (design); pending spec review
**Author:** Brainstormed with shop owner (Awais Malik)

---

## 1. Purpose

Replace the current free-form New Transaction form — where the cash channel and
the wallet channel are entered independently and commission is inert metadata —
with a **guided** model in which the owner enters the business event (deposit or
withdraw, the transfer amount, the commission, and which channel carries the
commission) and the app **derives** the exact wallet and cash movements. The
physical notes are then reconciled against the derived cash target, and a
mismatch blocks the save. This makes the two channels impossible to disagree and
makes commission a real participant in the money model.

This is the second of the two transaction-model fixes from the 2026-06-23 audit.
The first — Capital Adjustment (owner add/remove own money) — is complete on
`main`. The audit found three root problems this spec fixes:

- **Commission is inert metadata.** It is stored but never moves cash or a
  wallet, so the owner has to hand-balance the two channels to "absorb" the fee.
- **The two money channels are decoupled and unvalidated.** `amount` drives the
  wallet; `notesIn`/`notesOut` independently drive cash; nothing enforces they
  reconcile. A deposit can be saved with a drawer change that contradicts the
  wallet change and the stated commission.
- **`amount` is overloaded** — depending on type and commission sub-case it has
  meant gross deposit, net transfer, or load price.

## 2. Decisions (validated with the owner)

**Money model — owner confirmed "bilkul sahi" on 2026-06-23.** Example throughout:
transfer amount Rs 1000, commission Rs 20. Signs are from the shop's view. In
every deposit/withdraw case total worth rises by exactly the commission.

**DEPOSIT** (customer gives cash; shop sends from its wallet to the customer's account):
- commission in **cash** (extra): customer gives Rs 1020 cash, shop sends Rs 1000
  from wallet → cash **+1020**, wallet **−1000**, profit **+20**.
- commission in **wallet** (deducted from the transfer): customer gives Rs 1000
  cash, shop sends Rs 980 → cash **+1000**, wallet **−980**, profit **+20**.

**WITHDRAW** (customer sends to the shop's wallet; shop gives cash):
- commission in **wallet** (extra in the transfer): customer sends Rs 1020, shop
  gives Rs 1000 cash → wallet **+1020**, cash **−1000**, profit **+20**.
- commission in **cash** (less cash given): customer sends Rs 1000, shop gives
  Rs 980 cash → wallet **+1000**, cash **−980**, profit **+20**.

**Decisions captured during brainstorming (2026-06-24):**

1. **`commissionMode: 'cash' | 'wallet'`** — which channel carries the
   commission. Only meaningful for deposit/withdraw.
2. **Transaction types** → `'deposit' | 'withdraw' | 'easyload' | 'package' | 'other'`.
   Legacy `'send'` maps to `'deposit'`, legacy `'receive'` maps to `'withdraw'`.
3. **Easyload & packages are zero-profit** — pure cash-in = wallet-out, no
   commission. They use the **same** guided form with the commission/mode
   controls hidden and locked to zero.
4. **`discount` is dropped** from new transactions. Commission is the single
   profit lever (give a customer a break by entering a smaller commission). The
   field stays optional on the type so legacy records still read and compute.
5. **`other` stays** as the manual escape hatch (manual wallet direction + notes,
   today's behaviour) for cases the guided flow doesn't cover.
6. **Note entry:** keep both pickers (Notes Received + Change Given). The app
   validates `totalCash(notesIn) − totalCash(notesOut)` equals the derived cash
   target.
7. **Mismatch hard-blocks.** Confirm is disabled until the net notes equal the
   derived target. The domain also throws as defense-in-depth.
8. **Summary buckets renamed** `sent`/`received` → `deposited`/`withdrawn`
   (deposit→deposited, withdraw→withdrawn), with matching Dashboard labels.

## 3. Architecture

Follows the established layering: **domain ← data ← store ← UI**, lower layers
never importing upward. The derivation and reconciliation live in the domain so
the UI is a thin guided shell. Ids and timestamps are passed in (generated only
in the store action), per the existing invariants.

### 3.1 Data model

**`TransactionType`** becomes:

```ts
type TransactionType = 'deposit' | 'withdraw' | 'easyload' | 'package' | 'other'
```

**`CommissionMode`**:

```ts
type CommissionMode = 'cash' | 'wallet'
```

**`Transaction`** (changes from today):

```ts
interface Transaction {
  id: string
  type: TransactionType
  walletId: string | null
  walletDelta: Paisa          // signed; derived for guided types, manual for 'other'
  amount: Paisa               // the transfer amount (load value for easyload/package)
  commission: Paisa           // 0 for easyload/package
  commissionMode: CommissionMode  // which channel carries the fee (deposit/withdraw)
  cashDelta: Paisa            // signed net cash effect
  discount?: Paisa            // legacy only; omitted on new transactions
  customerName?: string
  customerPhone?: string
  note?: string
  createdAt: string
}
```

**`TransactionInput`**:

```ts
interface TransactionInput {
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
```

`CashMovement` is unchanged. The per-transaction `note` SHOULD be carried onto
its `CashMovement.note` so the cash ledger is self-explanatory (small fix the
audit flagged; in scope here since `applyTransaction` is being touched).

**Back-compat (`normalize.ts`).** On load, map legacy `type: 'send'` → `'deposit'`
and `'receive'` → `'withdraw'` (label only — the stored `walletDelta`,
`cashDelta`, and the linked `CashMovement.notes` are untouched, so balances and
delete-reversal stay correct). Back-fill `commissionMode: 'cash'` for any
transaction lacking it (legacy commission never moved money, so the mode is
cosmetic for old rows). Leave legacy `discount` values in place. No Supabase
migration — it is one JSONB blob.

### 3.2 Domain — `src/domain/transaction.ts`

**New pure helper — the heart of the redesign:**

```ts
/** Derive the signed wallet and cash movements for a guided transaction.
 *  amount = the transfer amount; commission = the shop's fee. Pure/deterministic. */
function deriveMovements(
  type: TransactionType,
  amount: Paisa,
  commission: Paisa,
  commissionMode: CommissionMode,
): { walletDelta: Paisa; cashDelta: Paisa }
```

Behaviour (signs from the shop's view):

| type | mode | cashDelta | walletDelta |
|---|---|---|---|
| `deposit` | `cash` | `+(amount + commission)` | `−amount` |
| `deposit` | `wallet` | `+amount` | `−(amount − commission)` |
| `withdraw` | `cash` | `−(amount − commission)` | `+amount` |
| `withdraw` | `wallet` | `−amount` | `+(amount + commission)` |
| `easyload` | (any) | `+amount` | `−amount` |
| `package` | (any) | `+amount` | `−amount` |
| `other` | — | not derived (caller supplies) | not derived (caller supplies) |

For every deposit/withdraw row, `cashDelta + walletDelta === ±commission` such
that total worth rises by exactly `commission`. Easyload/package net to zero.

**`applyTransaction(data, input)` becomes the enforcement point:**

- **Guided types** (`deposit`/`withdraw`/`easyload`/`package`):
  - `{ walletDelta, cashDelta: expected } = deriveMovements(type, amount, commission, commissionMode)`.
    For easyload/package, `commission` is forced to `0`.
  - `actual = totalCash(input.notesIn) − totalCash(input.notesOut)`.
  - If `actual !== expected`, **throw `Error('CASH_MISMATCH')`**.
  - Apply the derived `walletDelta` to the wallet (when `walletId` set and
    `walletDelta !== 0`), apply `mergeNoteDelta(notesIn, notesOut)` to the
    drawer (may throw `NEGATIVE_NOTES`), and write one `'transaction'`
    `CashMovement` carrying those notes, `delta = expected`, and the note.
  - Record the `Transaction` with the derived `walletDelta`/`cashDelta`, the
    `commissionMode`, and `commission` (0 for easyload/package).
- **`other`:** unchanged from today — use `input.walletDelta ?? 0` and the notes
  directly, no derivation, no mismatch check. `commission` defaults to 0,
  `commissionMode` stored as given (default `'cash'`).
- Pure/immutable; `id`/`createdAt` come from the input.

**`deleteTransaction`** is unchanged — it already reverses from the stored
`walletDelta` and the linked `CashMovement.notes`, both of which remain accurate
under the new model and the legacy remap.

**Golden invariant.** For guided types the drawer moves by exactly
`mergeNoteDelta(notesIn, notesOut)`, whose value equals `expected`, which is the
movement's `delta`. The hard equality check guarantees it. So
`totalCash(drawer) === Σ cashMovements.delta` continues to hold.

### 3.3 Store — `src/store/appStore.ts`

`addTransaction(input: Omit<TransactionInput, 'id' | 'createdAt'>)` keeps its
shape and the standard pattern (guard → generate `id`/`createdAt` → call
`applyTransaction` → `await repo.save(next)` → `set`). The input gains
`commissionMode` and drops `discount`. The action surfaces `CASH_MISMATCH` and
`NEGATIVE_NOTES` to the caller (the UI catches them).

### 3.4 UI — `src/pages/NewTransaction.tsx` (rewrite)

One unified guided form whose fields depend on the selected type:

- **Type selector:** Deposit · Withdraw · Easyload · Package · Other.
- **Deposit / Withdraw:**
  - Amount (transfer), Commission, a **commission-mode toggle**
    ("Fee in cash" / "Fee in wallet"), and the wallet dropdown.
  - A **derived-target line**: e.g. "Drawer should go **+1020**, Jazzcash
    **−1000**, profit **+20**."
  - Two note pickers (Notes Received / Change Given) and a live
    **"Net vs Target"** readout. **Confirm is disabled until net === target.**
- **Easyload / Package:** Amount + wallet only; commission/mode hidden (zero
  profit); notes must net to `+amount`.
- **Other:** the current manual form (wallet direction out/in/none + amount +
  both note pickers), unchanged behaviour.
- Catch `CASH_MISMATCH` → "Notes don't match the transaction — off by Rs X."
  Catch `NEGATIVE_NOTES` → existing "change exceeds the drawer" message.
- On success → navigate to Dashboard (`/`).

All React hooks before any early-return guard. Zustand v5: no object-returning
store selectors; derive with `useMemo` in the component.

### 3.5 Summary — `src/domain/summary.ts`

- `DaySummary` and `walletStats` rename `sent`/`received` to
  `deposited`/`withdrawn`; bucket `type === 'deposit'` → `deposited += amount`,
  `type === 'withdraw'` → `withdrawn += amount`.
- `profit = Σ commission − Σ (discount ?? 0)` (legacy discount still subtracted;
  new transactions have no discount so it contributes 0).
- Dashboard labels updated to "Deposited" / "Withdrawn".

## 4. Testing

- **Domain — `deriveMovements`:** all six rows of the table above, asserting both
  `walletDelta` and `cashDelta`, and that worth-delta equals the commission
  (deposit/withdraw) or zero (easyload/package).
- **Domain — `applyTransaction`:**
  - Each guided type with matching notes → correct drawer, wallet, one
    `'transaction'` movement with `delta === expected`, note copied to movement.
  - Mismatched notes → throws `CASH_MISMATCH`; drawer/wallet untouched.
  - Change-given case (customer overpays, gets change) nets to the target and
    passes.
  - `NEGATIVE_NOTES` still thrown when change exceeds the drawer.
  - `other` → manual wallet delta + notes, no derivation, no mismatch check.
  - Golden invariant holds after each guided type.
  - Immutability: input `data` untouched.
- **Domain — `deleteTransaction`:** reversal still exact for a derived deposit
  and a derived withdraw (drawer, wallet, movement removed).
- **Back-compat — `normalize.test.ts`:** legacy `send`→`deposit`,
  `receive`→`withdraw`; missing `commissionMode` back-filled to `'cash'`; legacy
  `discount` preserved.
- **Summary — `summary.test.ts`:** `deposited`/`withdrawn` buckets; profit =
  commission − legacy discount; legacy-remapped rows counted correctly.
- **Store — `appStore.test.ts`:** `addTransaction` for a guided deposit updates
  drawer + wallet + ledger and persists (assert resulting `AppData`, not just
  navigation — per the wallet-sign lesson); `CASH_MISMATCH` rejects without
  mutating state.
- **Page — `NewTransaction.test.tsx`:** selecting Deposit shows the mode toggle
  and derived target; Confirm disabled until net === target; submitting a valid
  deposit writes the expected `AppData`; Easyload hides commission; Other keeps
  the manual flow.

## 5. Constraints (inherited from CLAUDE.md)

- Integer paisa everywhere; `toPaisa()` on input, `formatPKR()` on display.
- Domain pure/immutable/deterministic; ids and timestamps passed in.
- The golden invariant: every drawer change flows through a `CashMovement` whose
  `delta` matches.
- `verbatimModuleSyntax` ON — type-only imports use `import type`.
- `applyNoteDelta` throws `Error('NEGATIVE_NOTES')` — the UI must catch it; the
  new `CASH_MISMATCH` is caught the same way.
- `npm run build` is the type-check gate; run before declaring done.
- Zustand v5 — no store selectors returning fresh objects/arrays; derive with
  `useMemo` in the component.

## 6. Out of scope

- Editing a past transaction (delete + re-add instead).
- Company-side retailer margin on easyload/packages (owner confirmed zero profit
  on these).
- Per-wallet note tracking (wallets hold a single balance).
- Reports/aggregations beyond the existing Dashboard summary and wallet stats
  (deferred to the Reports sub-phase).
- Bulk re-statement of historical send/receive beyond the label remap.

## 7. Success criteria

- The owner enters a deposit or withdraw as a business event (amount, commission,
  mode) and the app derives the wallet and cash movements; the two channels
  cannot disagree.
- Entering notes that don't net to the derived cash target blocks the save with a
  clear message; the domain also rejects a mismatched input.
- Each of the four deposit/withdraw cases raises total worth by exactly the
  commission; easyload and packages net to zero profit.
- Legacy `send`/`receive` transactions display and behave as
  `deposit`/`withdraw` with no balance change and correct delete-reversal.
- After any transaction, `totalCash(drawer)` still equals `Σ cashMovements.delta`.
- The Dashboard shows Deposited/Withdrawn volumes and profit = Σ commission
  (minus any legacy discount).
