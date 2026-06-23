# PCO Capital Adjustment (Add / Remove Own Money) Design Spec

**Date:** 2026-06-23
**Status:** Approved (design); pending spec review
**Author:** Brainstormed with shop owner (Awais Malik)

---

## 1. Purpose

Let the owner put **their own money into** — or **take their own money out of** — the
cash drawer and/or a digital wallet, with a full audit trail, **without** it being a
customer transaction and **without** affecting profit. This is a capital injection /
withdrawal, not a sale.

This is the first of two transaction-model fixes that came out of the transaction
audit (2026-06-23). The second — **guided deposit/withdraw with real commission** —
is a separate spec → plan → build cycle to follow this one. The audit found:

- The `CashMovement.sourceType` union already reserves `'adjustment'`, but it is a
  **dead literal** — no domain function, store action, or UI ever produces it.
- The only ways to change balances outside a customer transaction today are abuse:
  fabricating a fake `'other'` transaction, or overwriting a wallet balance via
  `upsertWallet` with **no audit trail**. Both break the app's core promise — "every
  rupee in and out is tracked."

## 2. Decisions (from brainstorming)

1. **Add and remove, both.** A capital adjustment is **signed** — the owner can put
   money in or take money out. (Owner confirmed they need to take money out too, not
   just add.)
2. **Cash and/or wallet.** One adjustment can touch the **cash drawer** (note-by-note),
   a **digital wallet**, or both. At least one must be non-empty.
3. **No profit, out of customer history.** An adjustment earns nothing and never
   appears in the transaction list, the sent/received volumes, or the profit figure.
   It only moves balances (so total worth updates automatically) and leaves an audit
   trail.
4. **Reversible.** An adjustment can be deleted, fully reversing its effect — same as
   a kharcha.

## 3. Architecture

Follows the established layering: **domain ← data ← store ← UI**, lower layers never
importing upward. A new pure domain module (`adjustment.ts`) mirrors `expense.ts`:
pure, immutable functions take `AppData` plus an input and return new `AppData`,
generating a `CashMovement` for the cash change. Ids and timestamps are passed in
(generated only in the store action).

### 3.1 Data model

**New entity — `Adjustment`** (one row per capital add/remove):

```ts
interface Adjustment {
  id: string
  /** Signed paisa change to the cash drawer (0 if this adjustment did not touch cash). */
  cashDelta: Paisa
  /** Signed per-denomination delta actually applied to the drawer (empty {} if no cash). */
  notes: Record<number, number>
  /** Target wallet id, or null if this adjustment did not touch a wallet. */
  walletId: string | null
  /** Signed paisa change to that wallet (0 if no wallet). */
  walletDelta: Paisa
  /** Optional reason / description. */
  note?: string
  createdAt: string
}
```

**`AppData` gains** `adjustments: Adjustment[]`. As with the Phase 3/4A arrays,
`normalize.ts` back-fills `adjustments: []` for older persisted data (no Supabase
migration — it's one JSONB blob) and `seed.ts` seeds `adjustments: []`.

**`CashMovement.sourceType`** already includes `'adjustment'` — no type change needed.
A cash adjustment finally produces a real `'adjustment'` movement in the unified cash
ledger (and the Cash page's "Recent cash movements").

`Settings` is unchanged. The `Transaction` model is unchanged (adjustments are **not**
transactions).

### 3.2 Domain — new `src/domain/adjustment.ts`

```ts
interface AdjustmentInput {
  id: string
  createdAt: string
  /** Signed per-denomination delta to the drawer. Positive counts add notes, negative
   *  remove them. Empty {} or omitted = no cash change. The UI sets the sign from the
   *  add/remove direction. */
  cashNotes?: Record<number, number>
  /** Target wallet id; null/omitted = no wallet change. */
  walletId?: string | null
  /** Signed paisa change to the wallet (positive add, negative remove). 0 if no wallet. */
  walletDelta?: Paisa
  note?: string
}

function applyAdjustment(data: AppData, input: AdjustmentInput): AppData
function deleteAdjustment(data: AppData, adjustmentId: string): AppData
```

`applyAdjustment` behaviour (pure, immutable, deterministic):

- Normalise inputs: `cashNotes = input.cashNotes ?? {}`, `walletDelta = input.walletDelta ?? 0`,
  `walletId = input.walletId ?? null`.
- **Cash part** (only if `cashNotes` has any non-zero entry):
  - `cashDelta = totalCash(cashNotes)` (signed).
  - `drawer = applyNoteDelta(data.drawer, cashNotes)` — **throws `Error('NEGATIVE_NOTES')`**
    if a removal exceeds what the drawer holds. (Same guard as kharcha; the UI catches it.)
  - Prepend a `CashMovement`: `{ id: \`${input.id}-c\`, sourceType: 'adjustment',
    sourceId: input.id, delta: cashDelta, notes: cashNotes, note: input.note,
    createdAt: input.createdAt }`.
- **Wallet part** (only if `walletId` is set and `walletDelta !== 0`):
  - `wallets = data.wallets.map(w => w.id === walletId ? applyWalletDelta(w, walletDelta) : w)`.
- Always prepend an `Adjustment` snapshot to `data.adjustments`, recording `cashDelta`
  (0 if no cash), `notes` (`{}` if no cash), `walletId`, `walletDelta` (0 if no wallet),
  `note`, `createdAt`.
- An adjustment with neither a cash change nor a wallet change is a no-op record (the
  UI prevents it; the domain still records the snapshot for honesty if called).

`deleteAdjustment` (mirror of `deleteExpense`):

- Find the adjustment by id; return `data` unchanged if not found.
- Reverse the cash part: find the `CashMovement` by `sourceId === adjustmentId`; if
  present, `drawer = applyNoteDelta(data.drawer, negateNotes(movement.notes))`, and
  drop that movement.
- Reverse the wallet part: if `walletId` set and `walletDelta !== 0`, apply
  `applyWalletDelta(w, -walletDelta)` to that wallet.
- Drop the adjustment from `data.adjustments`.

**Golden invariant.** The drawer changes by exactly `cashNotes` whose value is
`cashDelta`, matched by the movement's `delta`. So `totalCash(drawer) === Σ
cashMovements.delta` continues to hold. The wallet change has no bearing on the cash
invariant. Deleting reverses both sides exactly.

**No double-counting of profit.** Adjustments are never read by `summarize()` (which
only walks `transactions` and `expenses`), so they contribute nothing to profit,
sent, or received. `totalWorth()` reflects the new balances automatically because it
sums cash + wallets.

### 3.3 Store — `src/store/appStore.ts`

```ts
addAdjustment(input: Omit<AdjustmentInput, 'id' | 'createdAt'>): Promise<void>
deleteAdjustment(id: string): Promise<void>
```

Standard action pattern: guard `if (!repo || !data) return`; for `addAdjustment`
generate `id = crypto.randomUUID()`, `createdAt = new Date().toISOString()`; call
the pure domain function; `await repo.save(next)`; `set({ data: next })`.

### 3.4 UI

**New page — `src/pages/Adjustment.tsx`** at route `/adjustment`:

- **Direction toggle:** "Add money" / "Take money out". This sets the sign applied to
  both the cash notes and the wallet amount on submit (the inputs themselves stay
  positive; the page negates them for "Take money out").
- **Cash section (optional):** reuses `NotePicker` (starts empty) for the notes to add
  or remove. Live subtotal via `totalCash`.
- **Wallet section (optional):** a wallet dropdown + an amount field (`toPaisa` on
  input). Leaving the amount at 0 / no wallet means no wallet change.
- **Reason** input (optional but encouraged).
- **Live preview:** new cash total and (if a wallet is chosen) new wallet balance after
  the adjustment.
- **Validation:**
  - At least one of cash / wallet must be non-zero, else **Confirm** is disabled.
  - On "Take money out", if removing more cash than the drawer holds, `applyAdjustment`
    throws `NEGATIVE_NOTES`; the page catches it and shows a clear error ("Drawer
    doesn't have those notes"). If removing more than a wallet's balance, the page
    disables Confirm (wallet would go negative).
- **Confirm** → `addAdjustment` → success → navigate back to Dashboard (`/`).
- **Adjustment History** list below: each row shows date, the cash and/or wallet change
  (signed, `formatPKR`), the reason, and a **Delete** button (calls `deleteAdjustment`).
  Most recent first.

**Wiring:**

- **Cash & Notes page** (`src/pages/Cash.tsx`) — add an "Add / Remove Money" button near
  the top (next to "Count & Verify"), linking to `/adjustment`.
- **Dashboard** (`src/pages/Dashboard.tsx`) — add an "Add / Remove Money" quick-action
  link to `/adjustment`, alongside the existing quick-actions.
- **`src/App.tsx`** — register the `/adjustment` route under `AppLayout`.

## 4. Testing

- **Domain (`adjustment.test.ts`):**
  - Add cash only → drawer up, one `'adjustment'` movement with positive `delta`, one
    `Adjustment` snapshot, no wallet change, golden invariant holds.
  - Remove cash only → drawer down, negative `delta` movement; removing more than the
    drawer holds throws `NEGATIVE_NOTES`.
  - Add wallet only → wallet balance up, no `CashMovement`, snapshot records
    `walletId` + positive `walletDelta`.
  - Add cash **and** wallet in one adjustment → both move, one movement + one snapshot.
  - `deleteAdjustment` reverses cash (drawer + movement removed) and wallet exactly;
    unknown id returns data unchanged.
  - Does not mutate the input `data`.
  - Does not touch `transactions`, `expenses`, or profit-relevant arrays.
- **Store (`appStore.test.ts`):** `addAdjustment` appends to `adjustments` + (for cash)
  `cashMovements`, updates `drawer`/`wallets`, and persists through the repository
  (`repo.load()` assertion). `deleteAdjustment` reverses and persists.
- **Back-compat (`normalize.test.ts`):** old data without `adjustments` gets
  `adjustments: []`.
- **Page (`Adjustment.test.tsx`):** add-cash flow updates the drawer and records an
  adjustment; "Take money out" negates the change; Confirm disabled when nothing is
  entered; history list renders and Delete reverses.

## 5. Constraints (inherited from CLAUDE.md)

- Integer paisa everywhere; `toPaisa()` on input, `formatPKR()` on display.
- Domain pure/immutable/deterministic; ids and timestamps passed in.
- The golden invariant: every drawer change flows through a `CashMovement` whose
  `delta` matches.
- `verbatimModuleSyntax` ON — type-only imports use `import type`.
- `applyNoteDelta` throws `Error('NEGATIVE_NOTES')` — the UI must catch it.
- `npm run build` is the type-check gate; run before declaring done.
- Zustand v5 — no store selectors returning fresh objects/arrays; derive with
  `useMemo` in the component.
- Never mutate a wallet balance via `upsertWallet` for capital changes — every balance
  change goes through an audited adjustment.

## 6. Out of scope (for this spec)

- Guided deposit/withdraw + real commission (next spec).
- Editing a past adjustment (delete + re-add instead).
- Per-wallet cash-style note tracking (wallets hold a single balance, not notes — same
  as today).
- Reports/aggregations of adjustments beyond the on-page history list (deferred to the
  Reports sub-phase).

## 7. Success criteria

- The owner can add their own cash (note-by-note) and/or wallet money in one action;
  balances and total worth go up; an `'adjustment'` cash movement and an `Adjustment`
  record are created; nothing appears in customer transaction history or profit.
- The owner can take money out the same way; balances go down; removing more cash than
  the drawer holds is blocked with a clear message.
- After any adjustment, `totalCash(drawer)` still equals `Σ cashMovements.delta`.
- An adjustment can be deleted, fully reversing both its cash and wallet effects.
- Add / Remove Money is reachable from both the Dashboard and the Cash page.
