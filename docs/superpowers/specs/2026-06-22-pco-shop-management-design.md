# PCO / Easyload Shop Management Software — Design Spec

**Date:** 2026-06-22
**Status:** Approved (design); pending spec review
**Author:** Brainstormed with shop owner (Awais Malik)

---

## 1. Purpose

A cloud web application for a Pakistani PCO / Easyload / mobile-packages shop to manage
its money with total accuracy. It replaces the shop's current software ("Saleem PCO"),
which only tracks digital wallets and is "not good enough."

The headline requirement from the owner:

> "1 rupya bhi shop se jaye to pata lage, aur aaye to bhi pata lage."
> (If even 1 rupee leaves the shop you know, and if it comes in you know.)

To achieve that, the app tracks **physical cash note-by-note**, every **digital wallet**,
all **expenses (kharcha)**, and all **credit (udhari)** — and keeps them all reconciled so
no rupee is ever unaccounted for.

## 2. Users & Scope

- **Single shop, single shared login** (one PIN/password the shop uses).
- Accessible from the **shop PC (browser)** and the **owner's phone** (installable PWA),
  sharing one live database that syncs in real time.
- Services the shop offers (and the app must model):
  - **Easyload** / mobile balance top-up
  - **Send / Receive money** (Easypaisa, JazzCash, Bank transfers)
  - **Mobile packages** (call / SMS / data bundles)
- Out of scope for now: utility bill payments, SIM sales, physical-item inventory,
  multi-branch, per-staff accounts. (May be added later.)

## 3. Core Concept — The Money Model

The app maintains three things that must always stay consistent:

1. **Cash Drawer** — physical notes, tracked **per denomination**
   (5000, 1000, 500, 100, 50, 20, 10, and coins). Big-notes total and small-notes total
   are auto-calculated from a configurable threshold.
2. **Digital Wallets** — Easypaisa, JazzCash, Bank — each holding a balance.
3. **Profit** — accumulated commission earned minus discount given.

### 3.1 The Golden Invariant (the heart of the app)

> **Total Cash (sum of all notes) === Sum of every cash movement ever recorded.**

Every event that moves cash — a sale, a kharcha, an udhar given/repaid, change handed
back, or a manual adjustment — creates a **cash movement** record, and (for cash events)
a **note-level** record of which notes went in/out. Because notes are picked on every cash
transaction, the drawer's denomination counts are always live-accurate.

A **Count & Verify** feature lets the owner physically count the drawer and compare the
counted total against the expected total; any mismatch is flagged and can be reconciled
with a reason.

### 3.2 Transaction effects

A single transaction can update **wallet + cash + profit together**. Example:

> Customer sends Rs 5,000 via JazzCash, pays Rs 50 fee:
> - JazzCash wallet: **−5,000**
> - Cash drawer: **+5,050** (note picker records the notes received and any change given)
> - Profit (commission): **+50**

The app also supports **cash-only** transactions (e.g. easyload where you load from a
balance and take cash) and **wallet-only** adjustments when a deal needs it.

## 4. Configuration Defaults

- **Big notes (Bare Note):** 500, 1000, 5000
- **Small notes (Chote Note):** 10, 20, 50, 100, and coins
- **Wallets:** Easypaisa, JazzCash, Bank
- All of the above are editable in Settings.

## 5. Screens

### 5.1 Dashboard (Home)
- Large **Total Cash** with **Big Notes / Small Notes** split.
- Each **wallet balance** (Easypaisa, JazzCash, Bank).
- **Total Worth** = Cash + Wallet balances + (udhar receivable) − (udhar payable).
- **Today's summary:** transaction count, Sent, Received, Profit, Kharcha, Udhar.
- Quick-action buttons: New Transaction, Kharcha, Udhar, Count Drawer.

### 5.2 New Transaction (fast daily screen)
- **Type:** Easyload · Send money · Receive money · Package · Other.
- Pick **wallet** (when applicable) → enter **Amount**, **Commission/profit**, **Discount**.
- **Note picker:** tap +/− on each denomination for cash received and change given back;
  the net cash effect is shown live.
- Optional **customer name / phone** for searchable history.
- Save → atomically updates wallet balance + cash notes + profit.

### 5.3 Cash & Notes
- Denomination table: per note `count × value = total`, plus big/small subtotals and grand
  total.
- **Count & Verify:** enter physically-counted notes → app shows **Expected vs Counted** →
  flags any difference, records an adjustment with a reason if confirmed.
- Full **cash in/out history** with reason and source (transaction / kharcha / udhar /
  adjustment).

### 5.4 Wallets
- List wallets with balances and per-wallet Sent / Received / Commission / Discount.
- Add / edit / rename wallet; manual balance adjustment with reason.
- Per-wallet transaction history.

### 5.5 Udhari Book (credit / lending)
- **Per-person ledger.** Each person has name + phone and a **running balance**
  (owes you / you owe).
- Totals: total receivable, total payable.
- Tap a person → full history; **add udhar** (cash out) or **record repayment** (cash in),
  each auto-adjusting the cash drawer via the note picker.

### 5.6 Kharcha (Expenses)
- Add expense: amount, **category** (bijli, chai, rent, etc.), note, paid from cash
  (note picker → cash out).
- Daily / monthly totals, grouped by category.

### 5.7 Reports
- Day / week / month views: profit, kharcha, sent/received, cash flow.
- Breakdowns per wallet and per expense category.
- (Export to file: optional, later.)

### 5.8 Settings
- Manage wallets, big/small note threshold, denomination list, shop name, login PIN,
  data backup.

## 6. Data Model (relational / Postgres)

- `settings` — shop_name, pin_hash, big_note_threshold, denomination config.
- `wallets` — id, name, type, balance.
- `denominations` — value, is_big, count (current drawer state).
- `transactions` — id, type, wallet_id, amount, commission, discount, cash_delta,
  customer_name, customer_phone, note, created_at.
- `cash_movements` — id, source_type (transaction | kharcha | udhar | adjustment | count),
  source_id, delta, note, created_at. **The unified cash ledger.**
- `note_movements` — id, cash_movement_id, denomination_value, count_delta.
- `persons` — id, name, phone (udhari contacts).
- `udhar_entries` — id, person_id, type (given | received | repayment), amount,
  cash_movement_id, note, created_at.
- `expenses` — id, category, amount, cash_movement_id, note, created_at.
- `counts` — id, counted_total, expected_total, difference, note, created_at
  (reconciliation snapshots).

**Derived values:**
- `Total Cash = Σ (denominations.count × value)`
- `Profit (period) = Σ commission − Σ discount`
- Invariant check: `Total Cash === Σ cash_movements.delta`

**Integrity:** all multi-table writes (a transaction touching wallet + cash + profit) run
inside a Postgres transaction / RPC function so balances never drift.

## 7. Technical Approach

- **Frontend:** React + TypeScript + Vite; Tailwind CSS + shadcn/ui; mobile-first,
  responsive; installable **PWA** for phone use.
- **Backend / DB:** **Supabase** (managed Postgres + Auth + Realtime). Realtime gives
  live PC↔phone sync.
- **Hosting:** Vercel (frontend) + Supabase (database).
- **Money integrity:** denomination math in integers (paisa-safe); atomic RPC functions
  for compound writes.

### Alternatives considered
- **Firebase / Firestore** — rejected: NoSQL is weak for ledger/accounting consistency
  and aggregations.
- **Offline desktop-only app** — rejected: owner explicitly wants phone access.

## 8. Build Order (phases)

1. **Phase 1 — Foundation:** project setup, DB schema + migrations, shared login,
   wallets + cash drawer core, dashboard skeleton, settings for denominations/wallets.
2. **Phase 2 — Transactions:** the fast New Transaction flow with note-picker, atomic
   wallet+cash+profit updates, transaction history + search.
3. **Phase 3 — Kharcha + Udhari:** expenses with categories; per-person udhari ledger
   with cash-linked give/repay.
4. **Phase 4 — Reports, Count & Verify, Settings polish, PWA install, final UX pass.**

## 9. Success Criteria

- At any moment, **Total Cash by notes === sum of all cash movements** (no drift).
- Owner can see, on PC or phone, live: total cash (big/small split), each wallet balance,
  total worth, today's profit and kharcha.
- Every rupee in or out is traceable to a logged reason.
- A drawer count that doesn't match expected is clearly flagged.
- Daily operation (adding a sale) is fast — a few taps including the note picker.
