# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A cash-accounting web app for a Pakistani PCO / Easyload / mobile-packages shop. The headline requirement: track **every rupee** in and out — "1 rupya bhi shop se jaye to pata lage, aur aaye to bhi pata lage." Physical cash is tracked **note-by-note** (per denomination, big vs small), alongside digital wallets (Easypaisa/JazzCash/Bank). Single shared PIN login. Built mobile-first (used on phone + PC).

Status: Phase 1 (foundation) and Phase 2A (transactions + cash ledger) are complete and on `main`. Runs entirely on `localStorage`; Phase 2B will add a Supabase backend behind the existing `Repository` seam with no domain/UI changes.

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
  - `cash.ts` — `DrawerCounts`, `totalCash`/`bigTotal`/`smallTotal`, `applyNoteDelta` (throws), `emptyDrawer`
  - `wallet.ts` — `Wallet`, `applyWalletDelta`, `profit`
  - `transaction.ts` — `Transaction`, `CashMovement`, `TransactionInput`, `applyTransaction`, `deleteTransaction` (full reversal), `mergeNoteDelta`. `walletDelta` is a **signed** delta added to the wallet balance: money leaving a wallet is **negative**, arriving is **positive**.
  - `summary.ts` — `summarize`, `todaysTransactions`/`isSameDay`, `searchTransactions`, `walletStats`

- **`src/data/`** — persistence behind the `Repository` interface (`load(): Promise<AppData>`, `save(data): Promise<void>`). `AppData` is the single persisted blob (`settings`, `wallets`, `drawer`, `transactions`, `cashMovements`). Implementations: `InMemoryRepository` (tests) and `LocalStorageRepository` (runtime, key `pco_app_data`; backs up corrupt JSON to `pco_app_data_corrupt` and reseeds). `normalize.ts`'s `normalizeAppData` fills arrays missing from older persisted data (back-compat) and is called on load by both repositories. `seed.ts` provides defaults (PIN `1234`, the three wallets, default denominations).

- **`src/store/appStore.ts`** — a single Zustand store (`useAppStore`) holding `repo`/`data`/`authed`. Actions (`addTransaction`, `deleteTransaction`, `updateSettings`, `upsertWallet`, `removeWallet`) follow one pattern: build the next `AppData` via a pure domain function → `await repo.save(next)` → `set({ data: next })`. Read-only derived values are exported **scalar** selectors (`selectTotalCash`, `selectBigTotal`, `selectSmallTotal`).
  - **Zustand v5 trap:** a selector returning a *fresh object/array* on each call causes "Maximum update depth exceeded" infinite re-renders. Do not write object-returning store selectors. Derive such values in the component with `useMemo` over the raw slice (see `Dashboard.tsx` and how today's summary is computed there).

- **`src/pages/` + `src/components/`** — the UI. `App.tsx` gates on `data`/`authed` then routes (`/`, `/new`, `/transactions`, `/cash`, `/settings`) under `AppLayout`'s bottom nav. `main.tsx` is where the repository is injected (`init(new LocalStorageRepository())`) — **this is the single swap point** for the future `SupabaseRepository`.

Styling is Tailwind v3 with an emerald/slate palette.

## Conventions

- Reference design/plan docs live in `docs/superpowers/` (spec + per-phase plans). Per-phase planning artifacts and review packages are under `.superpowers/sdd/`.
- Building a phase: implement task-by-task with TDD (write the failing test, make it pass), then run a whole-branch review before merging. Past experience: a critical wallet-sign bug passed every per-task review because its test only asserted navigation, not store state — assert the resulting `AppData` (balances, ledger), not just that the UI moved.
