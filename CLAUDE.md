# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A cash-accounting web app for a Pakistani PCO / Easyload / mobile-packages shop. The headline requirement: track **every rupee** in and out — "1 rupya bhi shop se jaye to pata lage, aur aaye to bhi pata lage." Physical cash is tracked **note-by-note** (per denomination, big vs small), alongside digital wallets (Easypaisa/JazzCash/Bank). Single shared PIN login. Built mobile-first (used on phone + PC).

Status: Phases 1, 2A, 2B, 3, and 4A are complete on `main`. Backed by **Supabase** (Postgres JSONB, single `app_state` row). Phase 3 added Kharcha (expense tracking) and Udhari (per-person credit ledger), settling against cash drawer or digital wallets. Phase 4A added Count & Verify (reconcile drawer to physical count).

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build  — the real type-check gate (see below)
npm run lint         # eslint .
npm test             # vitest run (full suite, one shot)
npm run test:watch   # vitest watch

npx vitest run transaction          # run one file/pattern (substring match on path)
npx vitest run --reporter=verbose summary   # one file, per-test output
```

Tests are colocated next to source as `*.test.ts(x)`, run under jsdom (`src/test-setup.ts` loads jest-dom matchers). `npm test` does **not** type-check — `vitest` transpiles without `tsc`. A change can pass the whole suite and still break the build. **Run `npm run build` before declaring work done or merging.**

Platform note: Windows. The default shell is PowerShell; a Bash tool is also available for POSIX scripts.

## Non-negotiable invariants

These are the spine of the app. Violating any of them is a correctness bug, not a style issue.

1. **Integer paisa everywhere.** All money is stored and computed as integer paisa (rupees × 100) via the `Paisa` type. Never use floating-point rupees in logic. Convert at the UI edge only: `toPaisa()` on input, `formatPKR()` on display. Literals use the `5000_00` (= Rs 5000) underscore style.

2. **The golden invariant:** `totalCash(drawer) === Σ cashMovements[].delta`. Every change to the cash drawer must flow through a `CashMovement` carrying the exact per-denomination `notes`. `applyTransaction`/`deleteTransaction` uphold this by construction — the same notes that move the drawer are what the movement records. When touching cash logic, prove this still holds.

3. **Domain functions are pure, immutable, and deterministic.** They return new objects (never mutate inputs) and never generate their own ids or timestamps — `id` and `createdAt` are passed *in*. The store actions are the only place `crypto.randomUUID()` and `new Date().toISOString()` are called; they generate these then delegate to the pure domain function. This keeps the domain unit-testable with fixed fixtures.

4. **`verbatimModuleSyntax` is ON** (plus `noUnusedLocals`/`noUnusedParameters`). Every type-only import MUST be `import type { … }` (or inline `import { type X, y }`), or the build fails. Unused imports/vars also fail the build.

5. **`applyNoteDelta` throws `Error('NEGATIVE_NOTES')`** if any denomination count would go negative (e.g. giving more change than the drawer holds, or reversing notes already spent). Both `applyTransaction` and `deleteTransaction` can throw it. UI call sites must `catch` it and surface a message — never let it become a silent no-op.

## Architecture

Strict one-way dependency flow: **domain ← data ← store ← UI**. Lower layers never import upward.

- **`src/domain/`** — pure TypeScript, zero React/IO. The brain of the app:
  - `money.ts` — `Paisa`, `toPaisa`, `toRupees`, `formatPKR`
  - `denominations.ts` — `Denomination`, `DEFAULT_DENOMINATIONS`, `isBigValue`
  - `cash.ts` — `DrawerCounts`, `totalCash`/`bigTotal`/`smallTotal`, `applyNoteDelta` (throws), `emptyDrawer`, `negateNotes` (flip note-map signs for reversals), `diffNotes` (per-denomination signed delta)
  - `wallet.ts` — `Wallet`, `applyWalletDelta`, `profit`, `PaymentMethod = 'cash' | 'wallet'`
  - `transaction.ts` — `Transaction`, `CashMovement`, `TransactionInput`, `applyTransaction`, `deleteTransaction` (full reversal), `mergeNoteDelta`. `walletDelta` is a **signed** delta added to the wallet balance: money leaving a wallet is **negative**, arriving is **positive**. `CashMovement.sourceType` is `'transaction' | 'adjustment' | 'kharcha' | 'udhar' | 'count'`.
  - `expense.ts` — `Expense`, `ExpenseInput`, `DEFAULT_EXPENSE_CATEGORIES`, `applyExpense`, `deleteExpense`. Cash expense logs a `'kharcha'` CashMovement; wallet expense deducts wallet only.
  - `udhar.ts` — `Person`, `UdharType` (`'given' | 'repayment'`), `UdharEntry`, `UdharInput`, `personBalance`, `udharTotals`, `applyUdhar`, `deleteUdhar`. Cash udhar logs a `'udhar'` CashMovement.
  - `count.ts` — `Count`, `CountInput`, `applyCount`. Reconciles the drawer to a physical count; logs a `'count'` CashMovement for any difference.
  - `summary.ts` — `summarize`, `todaysTransactions`/`isSameDay`, `searchTransactions`, `walletStats`, `ExpenseSummary`, `summarizeExpenses`, `todaysExpenses`, `totalWorth`

- **`src/data/`** — persistence behind the `Repository` interface (`load(): Promise<AppData>`, `save(data): Promise<void>`). `AppData` is the single persisted blob (`settings`, `wallets`, `drawer`, `transactions`, `cashMovements`, `persons`, `udharEntries`, `expenses`, `counts`). `settings` includes `expenseCategories: string[]`. Implementations: `InMemoryRepository` (tests), `LocalStorageRepository` (legacy/offline), and `SupabaseRepository` (production — persists the whole blob as one JSONB row in the `app_state` table, seeds on first load, throws on network error). `normalize.ts`'s `normalizeAppData` fills arrays missing from older persisted data (back-compat — no Supabase migration needed, it's one JSONB blob). `seed.ts` provides defaults (PIN `1234`, the three wallets, default denominations, `DEFAULT_EXPENSE_CATEGORIES`).

- **`src/store/appStore.ts`** — a single Zustand store (`useAppStore`) holding `repo`/`data`/`authed`. Actions follow one pattern: build the next `AppData` via a pure domain function → `await repo.save(next)` → `set({ data: next })`. Phase 3 adds: `addExpense`, `deleteExpense`, `addPerson` (returns `Promise<string>` — the new person id), `updatePerson`, `addUdhar`, `deleteUdhar`. Phase 4A adds: `recordCount`. Read-only derived values are exported **scalar** selectors (`selectTotalCash`, `selectBigTotal`, `selectSmallTotal`).
  - **Zustand v5 trap:** a selector returning a *fresh object/array* on each call causes "Maximum update depth exceeded" infinite re-renders. Do not write object-returning store selectors. Derive such values in the component with `useMemo` over the raw slice (see `Dashboard.tsx` and how today's summary is computed there).

- **`src/pages/` + `src/components/`** — the UI. `App.tsx` gates on `data`/`authed` then routes (`/`, `/new`, `/transactions`, `/cash`, `/settings`, `/kharcha`, `/udhari`, `/udhari/:personId`, `/count`) under `AppLayout`'s bottom nav (4 tabs; Kharcha and Udhari are dashboard quick-actions). `main.tsx` is the single DI point — currently injects `SupabaseRepository` built from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` env vars (see `.env.example`). Swapping the repository means changing only this file.

Styling is Tailwind v3 with an emerald/slate palette.

## Supabase

Production database: Supabase project `beuuswivjvdsfaixvhzd` (ap-northeast-2). Schema is in `supabase/schema.sql` — apply once via the Supabase SQL Editor (no migration tooling yet). The `app_state` table holds one singleton row (`id = 1`, `data jsonb`). RLS is enabled with a permissive anon policy — the PIN gate is client-side.

Local dev needs a `.env` file (copy `.env.example`, fill in real values). The build does not require `.env` — the missing-env guard is runtime-only.

`SupabaseRepository` tests are fully offline (injected `fakeSupabase()` helper in `supabaseRepository.test.ts`) — no Supabase project needed to run the test suite.

## Conventions

- Reference design/plan docs live in `docs/superpowers/` (spec + per-phase plans). Per-phase planning artifacts and review packages are under `.superpowers/sdd/`.
- Building a phase: implement task-by-task with TDD (write the failing test, make it pass), then run a whole-branch review before merging. Past experience: a critical wallet-sign bug passed every per-task review because its test only asserted navigation, not store state — assert the resulting `AppData` (balances, ledger), not just that the UI moved.
