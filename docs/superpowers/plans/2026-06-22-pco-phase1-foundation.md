# PCO Shop Management — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of the PCO shop app — a running, PIN-protected React web app that shows a live dashboard of total cash (with big/small note split) and wallet balances, plus a settings screen, all backed by fully-tested pure money logic that persists in the browser.

**Architecture:** Pure domain logic (money, denominations, cash drawer, wallets) lives in `src/domain/` as side-effect-free functions that are unit-tested in isolation. Persistence sits behind a `Repository` interface (`src/data/`) with two adapters: an in-memory one for tests and a `localStorage` one so the real app persists across reloads with no backend. A small Zustand store (`src/store/`) wires the repository to React. UI pages (`src/pages/`) read from the store. Phase 2 will add a Supabase adapter implementing the same `Repository` interface for cloud sync — no domain or UI changes required.

**Tech Stack:** Vite + React 18 + TypeScript, Tailwind CSS v3, Zustand, React Router v6, Vitest + @testing-library/react (jsdom).

## Global Constraints

- All money is stored as **integer paisa** (rupees × 100). Never use floating-point rupees for stored values. Display converts paisa → rupees only at the UI edge.
- **Single shared login**: one PIN gates the whole app (default PIN `1234`, changeable in Settings).
- **Default denominations:** big = 5000, 1000, 500; small = 100, 50, 20, 10, 5, 2, 1. (Big = 500/1000/5000; everything else is small.)
- **Default wallets:** Easypaisa, JazzCash, Bank.
- **Golden invariant (enforced from Phase 2 on):** Total Cash (Σ note value × count) === Σ of all cash movements. Phase 1 establishes the cash-total math this invariant depends on.
- **Mobile-first**: every screen must be usable on a phone-width viewport (≥360px).
- Currency display format: `Rs 1,23,456` style is acceptable; minimum requirement is `Rs ` prefix + thousands separators.

---

### Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx`
- Create: `src/domain/money.ts`
- Test: `src/domain/money.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working Vite app (`npm run dev`), a working test runner (`npm test`), and `formatPKR(paisa: number): string`, `toPaisa(rupees: number): number`, `toRupees(paisa: number): number` from `src/domain/money.ts`.

- [ ] **Step 1: Scaffold the Vite app**

Run:
```bash
cd "e:/Freelance/AwaisPCO"
npm create vite@latest . -- --template react-ts
```
If prompted that the directory is not empty, choose **"Ignore files and continue"** (the `docs/` and `.remember/` folders must be preserved).

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install
npm install zustand react-router-dom
npm install -D tailwindcss@3 postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

Replace `tailwind.config.js` with:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

Replace `src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-slate-50 text-slate-900; margin: 0; }
```

- [ ] **Step 4: Configure Vitest**

Replace `vite.config.ts` with:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

Create `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom'
```

Add scripts to `package.json` (merge into the existing `"scripts"` block):
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Write the failing test for money helpers**

Create `src/domain/money.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toPaisa, toRupees, formatPKR } from './money'

describe('money', () => {
  it('converts rupees to integer paisa', () => {
    expect(toPaisa(1)).toBe(100)
    expect(toPaisa(50.5)).toBe(5050)
    expect(toPaisa(706883.39)).toBe(70688339)
  })

  it('converts paisa back to rupees', () => {
    expect(toRupees(100)).toBe(1)
    expect(toRupees(5050)).toBe(50.5)
  })

  it('formats paisa as PKR with thousands separators', () => {
    expect(formatPKR(0)).toBe('Rs 0')
    expect(formatPKR(135612_00)).toBe('Rs 135,612')
    expect(formatPKR(5050)).toBe('Rs 50.50')
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- money`
Expected: FAIL — `Cannot find module './money'`.

- [ ] **Step 7: Implement the money helpers**

Create `src/domain/money.ts`:
```ts
/** All stored money is integer paisa (rupees * 100). */
export type Paisa = number

export function toPaisa(rupees: number): Paisa {
  return Math.round(rupees * 100)
}

export function toRupees(paisa: Paisa): number {
  return paisa / 100
}

/** Formats paisa as "Rs 1,234" (whole) or "Rs 1,234.50" (with paisa). */
export function formatPKR(paisa: Paisa): string {
  const rupees = paisa / 100
  const hasFraction = paisa % 100 !== 0
  const formatted = rupees.toLocaleString('en-PK', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })
  return `Rs ${formatted}`
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- money`
Expected: PASS (3 tests).

- [ ] **Step 9: Verify the app boots**

Run: `npm run dev`
Expected: Vite serves at `http://localhost:5173` with the default page and no console errors. Stop the server (Ctrl+C) after confirming.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite+React+TS app with Tailwind, Vitest, and money helpers"
```

---

### Task 2: Denomination model and classification

**Files:**
- Create: `src/domain/denominations.ts`
- Test: `src/domain/denominations.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Denomination { value: number; isBig: boolean }`
  - `DEFAULT_DENOMINATIONS: Denomination[]`
  - `isBigValue(value: number, denoms: Denomination[]): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/domain/denominations.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_DENOMINATIONS, isBigValue } from './denominations'

describe('denominations', () => {
  it('lists all default notes from highest to lowest', () => {
    const values = DEFAULT_DENOMINATIONS.map((d) => d.value)
    expect(values).toEqual([5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1])
  })

  it('classifies 500/1000/5000 as big notes', () => {
    expect(isBigValue(5000, DEFAULT_DENOMINATIONS)).toBe(true)
    expect(isBigValue(1000, DEFAULT_DENOMINATIONS)).toBe(true)
    expect(isBigValue(500, DEFAULT_DENOMINATIONS)).toBe(true)
  })

  it('classifies 100 and below as small notes', () => {
    expect(isBigValue(100, DEFAULT_DENOMINATIONS)).toBe(false)
    expect(isBigValue(10, DEFAULT_DENOMINATIONS)).toBe(false)
    expect(isBigValue(1, DEFAULT_DENOMINATIONS)).toBe(false)
  })

  it('returns false for an unknown value', () => {
    expect(isBigValue(7, DEFAULT_DENOMINATIONS)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- denominations`
Expected: FAIL — `Cannot find module './denominations'`.

- [ ] **Step 3: Implement the denomination model**

Create `src/domain/denominations.ts`:
```ts
export interface Denomination {
  value: number // whole-rupee note/coin value
  isBig: boolean
}

/** Default Pakistani note set, highest to lowest. Big = 500/1000/5000. */
export const DEFAULT_DENOMINATIONS: Denomination[] = [
  { value: 5000, isBig: true },
  { value: 1000, isBig: true },
  { value: 500, isBig: true },
  { value: 100, isBig: false },
  { value: 50, isBig: false },
  { value: 20, isBig: false },
  { value: 10, isBig: false },
  { value: 5, isBig: false },
  { value: 2, isBig: false },
  { value: 1, isBig: false },
]

export function isBigValue(value: number, denoms: Denomination[]): boolean {
  const match = denoms.find((d) => d.value === value)
  return match ? match.isBig : false
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- denominations`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/denominations.ts src/domain/denominations.test.ts
git commit -m "feat: add denomination model with big/small classification"
```

---

### Task 3: Cash drawer math

**Files:**
- Create: `src/domain/cash.ts`
- Test: `src/domain/cash.test.ts`

**Interfaces:**
- Consumes: `Denomination`, `isBigValue` from `./denominations`; `Paisa` from `./money`.
- Produces:
  - `type DrawerCounts = Record<number, number>` (note value → count)
  - `totalCash(counts: DrawerCounts): Paisa`
  - `bigTotal(counts: DrawerCounts, denoms: Denomination[]): Paisa`
  - `smallTotal(counts: DrawerCounts, denoms: Denomination[]): Paisa`
  - `applyNoteDelta(counts: DrawerCounts, delta: Record<number, number>): DrawerCounts` (throws `Error('NEGATIVE_NOTES')` if any resulting count < 0)
  - `emptyDrawer(denoms: Denomination[]): DrawerCounts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/cash.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_DENOMINATIONS } from './denominations'
import {
  DrawerCounts,
  totalCash,
  bigTotal,
  smallTotal,
  applyNoteDelta,
  emptyDrawer,
} from './cash'

const sample: DrawerCounts = { 5000: 2, 1000: 3, 100: 5, 10: 4 }
// 10000 + 3000 + 500 + 40 = 13540 rupees

describe('cash drawer math', () => {
  it('totals all notes in paisa', () => {
    expect(totalCash(sample)).toBe(1354000)
  })

  it('totals big notes only', () => {
    expect(bigTotal(sample, DEFAULT_DENOMINATIONS)).toBe(1300000) // 13000
  })

  it('totals small notes only', () => {
    expect(smallTotal(sample, DEFAULT_DENOMINATIONS)).toBe(54000) // 540
  })

  it('big + small equals total', () => {
    const big = bigTotal(sample, DEFAULT_DENOMINATIONS)
    const small = smallTotal(sample, DEFAULT_DENOMINATIONS)
    expect(big + small).toBe(totalCash(sample))
  })

  it('applies a positive note delta', () => {
    const next = applyNoteDelta(sample, { 5000: 1, 100: -2 })
    expect(next[5000]).toBe(3)
    expect(next[100]).toBe(3)
  })

  it('throws when a delta would make a count negative', () => {
    expect(() => applyNoteDelta(sample, { 10: -5 })).toThrow('NEGATIVE_NOTES')
  })

  it('does not mutate the input counts', () => {
    applyNoteDelta(sample, { 5000: 1 })
    expect(sample[5000]).toBe(2)
  })

  it('builds an empty drawer with a zero count per denomination', () => {
    const drawer = emptyDrawer(DEFAULT_DENOMINATIONS)
    expect(drawer[5000]).toBe(0)
    expect(drawer[1]).toBe(0)
    expect(totalCash(drawer)).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- cash`
Expected: FAIL — `Cannot find module './cash'`.

- [ ] **Step 3: Implement the cash math**

Create `src/domain/cash.ts`:
```ts
import { Paisa } from './money'
import { Denomination, isBigValue } from './denominations'

/** Note value (rupees) -> count held. */
export type DrawerCounts = Record<number, number>

export function totalCash(counts: DrawerCounts): Paisa {
  let rupees = 0
  for (const [value, count] of Object.entries(counts)) {
    rupees += Number(value) * count
  }
  return rupees * 100
}

export function bigTotal(counts: DrawerCounts, denoms: Denomination[]): Paisa {
  return subtotal(counts, (v) => isBigValue(v, denoms))
}

export function smallTotal(counts: DrawerCounts, denoms: Denomination[]): Paisa {
  return subtotal(counts, (v) => !isBigValue(v, denoms))
}

function subtotal(counts: DrawerCounts, include: (value: number) => boolean): Paisa {
  let rupees = 0
  for (const [value, count] of Object.entries(counts)) {
    const v = Number(value)
    if (include(v)) rupees += v * count
  }
  return rupees * 100
}

export function applyNoteDelta(
  counts: DrawerCounts,
  delta: Record<number, number>,
): DrawerCounts {
  const next: DrawerCounts = { ...counts }
  for (const [value, change] of Object.entries(delta)) {
    const v = Number(value)
    const result = (next[v] ?? 0) + change
    if (result < 0) throw new Error('NEGATIVE_NOTES')
    next[v] = result
  }
  return next
}

export function emptyDrawer(denoms: Denomination[]): DrawerCounts {
  const drawer: DrawerCounts = {}
  for (const d of denoms) drawer[d.value] = 0
  return drawer
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- cash`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/cash.ts src/domain/cash.test.ts
git commit -m "feat: add cash drawer totals, big/small split, and note-delta application"
```

---

### Task 4: Wallet math

**Files:**
- Create: `src/domain/wallet.ts`
- Test: `src/domain/wallet.test.ts`

**Interfaces:**
- Consumes: `Paisa` from `./money`.
- Produces:
  - `interface Wallet { id: string; name: string; balance: Paisa }`
  - `applyWalletDelta(w: Wallet, deltaPaisa: Paisa): Wallet` (allows negative result — a wallet can be overdrawn intentionally; returns a new object)
  - `profit(commissionPaisa: Paisa, discountPaisa: Paisa): Paisa`

- [ ] **Step 1: Write the failing test**

Create `src/domain/wallet.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { Wallet, applyWalletDelta, profit } from './wallet'

const easypaisa: Wallet = { id: 'w1', name: 'Easypaisa', balance: 19510_00 }

describe('wallet math', () => {
  it('applies a negative delta (money sent out of the wallet)', () => {
    const next = applyWalletDelta(easypaisa, -5000_00)
    expect(next.balance).toBe(14510_00)
  })

  it('applies a positive delta (money received into the wallet)', () => {
    const next = applyWalletDelta(easypaisa, 5000_00)
    expect(next.balance).toBe(24510_00)
  })

  it('does not mutate the input wallet', () => {
    applyWalletDelta(easypaisa, -1000_00)
    expect(easypaisa.balance).toBe(19510_00)
  })

  it('computes profit as commission minus discount', () => {
    expect(profit(50_00, 0)).toBe(5000)
    expect(profit(50_00, 10_00)).toBe(4000)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- wallet`
Expected: FAIL — `Cannot find module './wallet'`.

- [ ] **Step 3: Implement the wallet math**

Create `src/domain/wallet.ts`:
```ts
import { Paisa } from './money'

export interface Wallet {
  id: string
  name: string
  balance: Paisa
}

export function applyWalletDelta(w: Wallet, deltaPaisa: Paisa): Wallet {
  return { ...w, balance: w.balance + deltaPaisa }
}

export function profit(commissionPaisa: Paisa, discountPaisa: Paisa): Paisa {
  return commissionPaisa - discountPaisa
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- wallet`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/wallet.ts src/domain/wallet.test.ts
git commit -m "feat: add wallet balance math and profit helper"
```

---

### Task 5: Repository interface + in-memory adapter + seed data

**Files:**
- Create: `src/data/types.ts`, `src/data/repository.ts`, `src/data/inMemoryRepository.ts`, `src/data/seed.ts`
- Test: `src/data/inMemoryRepository.test.ts`

**Interfaces:**
- Consumes: `Denomination`, `DEFAULT_DENOMINATIONS`; `Wallet`; `DrawerCounts`, `emptyDrawer`.
- Produces:
  - `interface Settings { shopName: string; pin: string; denominations: Denomination[] }`
  - `interface AppData { settings: Settings; wallets: Wallet[]; drawer: DrawerCounts }`
  - `interface Repository { load(): Promise<AppData>; save(data: AppData): Promise<void> }`
  - `class InMemoryRepository implements Repository`
  - `seedData(): AppData`

- [ ] **Step 1: Write the failing test**

Create `src/data/inMemoryRepository.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { InMemoryRepository } from './inMemoryRepository'
import { seedData } from './seed'

describe('InMemoryRepository', () => {
  it('loads the seed data it was constructed with', async () => {
    const repo = new InMemoryRepository(seedData())
    const data = await repo.load()
    expect(data.settings.shopName).toBe('My PCO Shop')
    expect(data.wallets.map((w) => w.name)).toEqual(['Easypaisa', 'JazzCash', 'Bank'])
  })

  it('persists saved data for the next load', async () => {
    const repo = new InMemoryRepository(seedData())
    const data = await repo.load()
    data.settings.shopName = 'Saleem PCO'
    await repo.save(data)
    const reloaded = await repo.load()
    expect(reloaded.settings.shopName).toBe('Saleem PCO')
  })

  it('returns an independent copy on load (no shared mutation)', async () => {
    const repo = new InMemoryRepository(seedData())
    const a = await repo.load()
    a.settings.shopName = 'changed in memory only'
    const b = await repo.load()
    expect(b.settings.shopName).toBe('My PCO Shop')
  })

  it('seed default PIN is 1234', () => {
    expect(seedData().settings.pin).toBe('1234')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- inMemoryRepository`
Expected: FAIL — `Cannot find module './inMemoryRepository'`.

- [ ] **Step 3: Define data types**

Create `src/data/types.ts`:
```ts
import { Denomination } from '../domain/denominations'
import { Wallet } from '../domain/wallet'
import { DrawerCounts } from '../domain/cash'

export interface Settings {
  shopName: string
  pin: string
  denominations: Denomination[]
}

export interface AppData {
  settings: Settings
  wallets: Wallet[]
  drawer: DrawerCounts
}
```

- [ ] **Step 4: Define the repository interface**

Create `src/data/repository.ts`:
```ts
import { AppData } from './types'

export interface Repository {
  load(): Promise<AppData>
  save(data: AppData): Promise<void>
}
```

- [ ] **Step 5: Create seed data**

Create `src/data/seed.ts`:
```ts
import { AppData } from './types'
import { DEFAULT_DENOMINATIONS } from '../domain/denominations'
import { emptyDrawer } from '../domain/cash'

export function seedData(): AppData {
  return {
    settings: {
      shopName: 'My PCO Shop',
      pin: '1234',
      denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })),
    },
    wallets: [
      { id: 'easypaisa', name: 'Easypaisa', balance: 0 },
      { id: 'jazzcash', name: 'JazzCash', balance: 0 },
      { id: 'bank', name: 'Bank', balance: 0 },
    ],
    drawer: emptyDrawer(DEFAULT_DENOMINATIONS),
  }
}
```

- [ ] **Step 6: Implement the in-memory adapter**

Create `src/data/inMemoryRepository.ts`:
```ts
import { Repository } from './repository'
import { AppData } from './types'

function clone(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data))
}

export class InMemoryRepository implements Repository {
  private data: AppData

  constructor(initial: AppData) {
    this.data = clone(initial)
  }

  async load(): Promise<AppData> {
    return clone(this.data)
  }

  async save(data: AppData): Promise<void> {
    this.data = clone(data)
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- inMemoryRepository`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/data/
git commit -m "feat: add Repository interface, in-memory adapter, and seed data"
```

---

### Task 6: localStorage adapter + Zustand store

**Files:**
- Create: `src/data/localStorageRepository.ts`, `src/store/appStore.ts`
- Test: `src/data/localStorageRepository.test.ts`, `src/store/appStore.test.ts`

**Interfaces:**
- Consumes: `Repository`, `AppData`, `Settings`, `InMemoryRepository`, `seedData`; `Wallet`; `Paisa`; cash helpers `totalCash`, `bigTotal`, `smallTotal`.
- Produces:
  - `class LocalStorageRepository implements Repository` (key `pco_app_data`; falls back to `seedData()` when empty)
  - `useAppStore` Zustand hook exposing: `repo`, `data: AppData | null`, `authed: boolean`, `init(repo): Promise<void>`, `login(pin): boolean`, `logout()`, `updateSettings(patch): Promise<void>`, `upsertWallet(wallet): Promise<void>`, `removeWallet(id): Promise<void>`
  - selectors `selectTotalCash`, `selectBigTotal`, `selectSmallTotal` (each `(s) => Paisa`)

- [ ] **Step 1: Write the failing test for the localStorage adapter**

Create `src/data/localStorageRepository.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { LocalStorageRepository } from './localStorageRepository'

beforeEach(() => localStorage.clear())

describe('LocalStorageRepository', () => {
  it('returns seed data when storage is empty', async () => {
    const repo = new LocalStorageRepository()
    const data = await repo.load()
    expect(data.settings.pin).toBe('1234')
    expect(data.wallets).toHaveLength(3)
  })

  it('persists saved data to localStorage across instances', async () => {
    const repo = new LocalStorageRepository()
    const data = await repo.load()
    data.settings.shopName = 'Persisted Shop'
    await repo.save(data)

    const fresh = new LocalStorageRepository()
    const reloaded = await fresh.load()
    expect(reloaded.settings.shopName).toBe('Persisted Shop')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- localStorageRepository`
Expected: FAIL — `Cannot find module './localStorageRepository'`.

- [ ] **Step 3: Implement the localStorage adapter**

Create `src/data/localStorageRepository.ts`:
```ts
import { Repository } from './repository'
import { AppData } from './types'
import { seedData } from './seed'

const STORAGE_KEY = 'pco_app_data'

export class LocalStorageRepository implements Repository {
  async load(): Promise<AppData> {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seeded = seedData()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
    return JSON.parse(raw) as AppData
  }

  async save(data: AppData): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}
```

- [ ] **Step 4: Run the adapter test to verify it passes**

Run: `npm test -- localStorageRepository`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing test for the store**

Create `src/store/appStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import {
  useAppStore,
  selectTotalCash,
  selectBigTotal,
  selectSmallTotal,
} from './appStore'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
})

describe('appStore', () => {
  it('loads data on init', () => {
    expect(useAppStore.getState().data?.settings.shopName).toBe('My PCO Shop')
  })

  it('rejects a wrong PIN and accepts the right one', () => {
    expect(useAppStore.getState().login('0000')).toBe(false)
    expect(useAppStore.getState().authed).toBe(false)
    expect(useAppStore.getState().login('1234')).toBe(true)
    expect(useAppStore.getState().authed).toBe(true)
  })

  it('updates settings and persists', async () => {
    await useAppStore.getState().updateSettings({ shopName: 'Saleem PCO' })
    expect(useAppStore.getState().data?.settings.shopName).toBe('Saleem PCO')
  })

  it('upserts and removes wallets', async () => {
    await useAppStore.getState().upsertWallet({ id: 'sadapay', name: 'SadaPay', balance: 0 })
    expect(useAppStore.getState().data?.wallets).toHaveLength(4)
    await useAppStore.getState().removeWallet('sadapay')
    expect(useAppStore.getState().data?.wallets).toHaveLength(3)
  })

  it('selectors compute cash totals', async () => {
    const data = await new InMemoryRepository(seedData()).load()
    data.drawer = { 5000: 2, 100: 5 } // 10000 + 500 = 10500
    useAppStore.setState({ data })
    expect(selectTotalCash(useAppStore.getState())).toBe(1050000)
    expect(selectBigTotal(useAppStore.getState())).toBe(1000000)
    expect(selectSmallTotal(useAppStore.getState())).toBe(50000)
  })
})
```

- [ ] **Step 6: Run the store test to verify it fails**

Run: `npm test -- appStore`
Expected: FAIL — `Cannot find module './appStore'`.

- [ ] **Step 7: Implement the store**

Create `src/store/appStore.ts`:
```ts
import { create } from 'zustand'
import { Repository } from '../data/repository'
import { AppData, Settings } from '../data/types'
import { Wallet } from '../domain/wallet'
import { Paisa } from '../domain/money'
import { totalCash, bigTotal, smallTotal } from '../domain/cash'

interface AppState {
  repo: Repository | null
  data: AppData | null
  authed: boolean
  init: (repo: Repository) => Promise<void>
  login: (pin: string) => boolean
  logout: () => void
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  upsertWallet: (wallet: Wallet) => Promise<void>
  removeWallet: (id: string) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  repo: null,
  data: null,
  authed: false,

  async init(repo) {
    const data = await repo.load()
    set({ repo, data })
  },

  login(pin) {
    const ok = get().data?.settings.pin === pin
    if (ok) set({ authed: true })
    return ok
  },

  logout() {
    set({ authed: false })
  },

  async updateSettings(patch) {
    const { repo, data } = get()
    if (!repo || !data) return
    const next: AppData = { ...data, settings: { ...data.settings, ...patch } }
    await repo.save(next)
    set({ data: next })
  },

  async upsertWallet(wallet) {
    const { repo, data } = get()
    if (!repo || !data) return
    const exists = data.wallets.some((w) => w.id === wallet.id)
    const wallets = exists
      ? data.wallets.map((w) => (w.id === wallet.id ? wallet : w))
      : [...data.wallets, wallet]
    const next: AppData = { ...data, wallets }
    await repo.save(next)
    set({ data: next })
  },

  async removeWallet(id) {
    const { repo, data } = get()
    if (!repo || !data) return
    const next: AppData = { ...data, wallets: data.wallets.filter((w) => w.id !== id) }
    await repo.save(next)
    set({ data: next })
  },
}))

export const selectTotalCash = (s: AppState): Paisa =>
  s.data ? totalCash(s.data.drawer) : 0
export const selectBigTotal = (s: AppState): Paisa =>
  s.data ? bigTotal(s.data.drawer, s.data.settings.denominations) : 0
export const selectSmallTotal = (s: AppState): Paisa =>
  s.data ? smallTotal(s.data.drawer, s.data.settings.denominations) : 0
```

- [ ] **Step 8: Run the store test to verify it passes**

Run: `npm test -- appStore`
Expected: PASS (5 tests).

- [ ] **Step 9: Commit**

```bash
git add src/data/localStorageRepository.ts src/data/localStorageRepository.test.ts src/store/
git commit -m "feat: add localStorage adapter and Zustand app store with cash selectors"
```

---

### Task 7: App shell, routing, and PIN login gate

**Files:**
- Create: `src/pages/Login.tsx`, `src/components/AppLayout.tsx`, `src/lib/formatDate.ts`
- Modify: `src/main.tsx`, `src/App.tsx`
- Test: `src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: `useAppStore`, `LocalStorageRepository`.
- Produces: a `BrowserRouter` app where unauthenticated users see `Login`, and authenticated users see routed pages inside `AppLayout` (bottom nav: Home, Cash, Wallets, Settings). Routes `/`, `/cash`, `/wallets`, `/settings` exist (Cash/Wallets are placeholders this phase).

- [ ] **Step 1: Initialize the store in main.tsx**

Replace `src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { useAppStore } from './store/appStore'
import { LocalStorageRepository } from './data/localStorageRepository'

useAppStore.getState().init(new LocalStorageRepository())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

- [ ] **Step 2: Write the failing test for Login**

Create `src/pages/Login.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import { useAppStore } from '../store/appStore'
import Login from './Login'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
})

describe('Login', () => {
  it('shows an error on wrong PIN and authenticates on correct PIN', async () => {
    render(<Login />)
    const input = screen.getByLabelText(/pin/i)

    await userEvent.type(input, '0000')
    await userEvent.click(screen.getByRole('button', { name: /login/i }))
    expect(screen.getByText(/galat pin/i)).toBeInTheDocument()
    expect(useAppStore.getState().authed).toBe(false)

    await userEvent.clear(input)
    await userEvent.type(input, '1234')
    await userEvent.click(screen.getByRole('button', { name: /login/i }))
    expect(useAppStore.getState().authed).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- Login`
Expected: FAIL — `Cannot find module './Login'`.

- [ ] **Step 4: Implement the Login page**

Create `src/pages/Login.tsx`:
```tsx
import { useState } from 'react'
import { useAppStore } from '../store/appStore'

export default function Login() {
  const login = useAppStore((s) => s.login)
  const shopName = useAppStore((s) => s.data?.settings.shopName ?? 'PCO Shop')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!login(pin)) {
      setError('Galat PIN. Dobara koshish karein.')
      setPin('')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow"
      >
        <h1 className="mb-1 text-center text-2xl font-bold">{shopName}</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Shop Account Management</p>
        <label htmlFor="pin" className="mb-1 block text-sm font-medium">
          PIN
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-widest"
          autoFocus
        />
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="mt-2 w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white"
        >
          Login
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- Login`
Expected: PASS (1 test).

- [ ] **Step 6: Create the date helper**

Create `src/lib/formatDate.ts`:
```ts
export function todayLabel(d: Date = new Date()): string {
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
}
```

- [ ] **Step 7: Create the app layout with bottom navigation**

Create `src/components/AppLayout.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Home', end: true },
  { to: '/cash', label: 'Cash', end: false },
  { to: '/wallets', label: 'Wallets', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

export default function AppLayout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-3xl border-t bg-white">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-sm ${
                isActive ? 'font-semibold text-emerald-600' : 'text-slate-500'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
```

- [ ] **Step 8: Wire routing in App.tsx**

Replace `src/App.tsx`:
```tsx
import { Routes, Route } from 'react-router-dom'
import { useAppStore } from './store/appStore'
import Login from './pages/Login'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'

function Placeholder({ title }: { title: string }) {
  return <h1 className="text-xl font-bold">{title} — coming soon</h1>
}

export default function App() {
  const authed = useAppStore((s) => s.authed)
  const data = useAppStore((s) => s.data)

  if (!data) return <div className="p-8 text-center">Loading…</div>
  if (!authed) return <Login />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="cash" element={<Placeholder title="Cash & Notes" />} />
        <Route path="wallets" element={<Placeholder title="Wallets" />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
```

Note: `Dashboard` and `Settings` are created in Tasks 8 and 9. If executing strictly in order, temporarily replace those two imports/elements with `<Placeholder title="Dashboard" />` and `<Placeholder title="Settings" />`, then restore them in Tasks 8 and 9. (This note exists only because routing must compile now.)

- [ ] **Step 9: Run all tests**

Run: `npm test`
Expected: PASS (all suites green). If `Dashboard`/`Settings` not yet created, use the placeholders described in Step 8.

- [ ] **Step 10: Commit**

```bash
git add src/main.tsx src/App.tsx src/pages/Login.tsx src/pages/Login.test.tsx src/components/AppLayout.tsx src/lib/formatDate.ts
git commit -m "feat: add PIN login gate, app layout with bottom nav, and routing"
```

---

### Task 8: Dashboard

**Files:**
- Create: `src/pages/Dashboard.tsx`, `src/components/StatCard.tsx`
- Modify: `src/App.tsx` (restore real `Dashboard` import if placeholder was used)
- Test: `src/pages/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `useAppStore`, `selectTotalCash`, `selectBigTotal`, `selectSmallTotal`, `formatPKR`, `todayLabel`.
- Produces: a Dashboard rendering Total Cash (large), Big/Small split, each wallet balance, a today-summary row (zeros this phase), and quick-action buttons that link to `/cash` and `/wallets`.

- [ ] **Step 1: Write the failing test**

Create `src/pages/Dashboard.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import { useAppStore } from '../store/appStore'
import Dashboard from './Dashboard'

beforeEach(async () => {
  const data = seedData()
  data.drawer = { 5000: 2, 100: 5 } // 10,500
  data.wallets = [{ id: 'easypaisa', name: 'Easypaisa', balance: 19510_00 }]
  useAppStore.setState({ data: null, authed: true, repo: null })
  const repo = new InMemoryRepository(data)
  await useAppStore.getState().init(repo)
  useAppStore.setState({ authed: true })
})

function renderDash() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  it('shows total cash and the big/small split', () => {
    renderDash()
    expect(screen.getByText('Rs 10,500')).toBeInTheDocument() // total
    expect(screen.getByText('Rs 10,000')).toBeInTheDocument() // big
    expect(screen.getByText('Rs 500')).toBeInTheDocument() // small
  })

  it('lists each wallet balance', () => {
    renderDash()
    expect(screen.getByText('Easypaisa')).toBeInTheDocument()
    expect(screen.getByText('Rs 19,510')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- Dashboard`
Expected: FAIL — `Cannot find module './Dashboard'`.

- [ ] **Step 3: Create the StatCard component**

Create `src/components/StatCard.tsx`:
```tsx
export default function StatCard({
  label,
  value,
  accent = 'text-slate-900',
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${accent}`}>{value}</div>
    </div>
  )
}
```

- [ ] **Step 4: Implement the Dashboard**

Create `src/pages/Dashboard.tsx`:
```tsx
import { Link } from 'react-router-dom'
import {
  useAppStore,
  selectTotalCash,
  selectBigTotal,
  selectSmallTotal,
} from '../store/appStore'
import { formatPKR } from '../domain/money'
import { todayLabel } from '../lib/formatDate'
import StatCard from '../components/StatCard'

export default function Dashboard() {
  const shopName = useAppStore((s) => s.data?.settings.shopName ?? 'PCO Shop')
  const wallets = useAppStore((s) => s.data?.wallets ?? [])
  const total = useAppStore(selectTotalCash)
  const big = useAppStore(selectBigTotal)
  const small = useAppStore(selectSmallTotal)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">{shopName}</h1>
        <p className="text-sm text-slate-500">{todayLabel()}</p>
      </header>

      <section className="rounded-2xl bg-emerald-600 p-4 text-white">
        <div className="text-sm opacity-90">Total Cash</div>
        <div className="text-3xl font-extrabold">{formatPKR(total)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/15 p-2">
            <div className="text-xs opacity-90">Bare Note (Big)</div>
            <div className="font-bold">{formatPKR(big)}</div>
          </div>
          <div className="rounded-lg bg-white/15 p-2">
            <div className="text-xs opacity-90">Chote Note (Small)</div>
            <div className="font-bold">{formatPKR(small)}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Wallets</h2>
        <div className="grid grid-cols-2 gap-2">
          {wallets.map((w) => (
            <StatCard key={w.id} label={w.name} value={formatPKR(w.balance)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Today</h2>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Transactions" value="0" />
          <StatCard label="Profit" value={formatPKR(0)} accent="text-emerald-600" />
          <StatCard label="Kharcha" value={formatPKR(0)} accent="text-red-600" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Link to="/cash" className="rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
          Count Drawer
        </Link>
        <Link to="/wallets" className="rounded-xl bg-slate-200 py-3 text-center font-semibold">
          Wallets
        </Link>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Restore the Dashboard route**

If Task 7 used a placeholder, ensure `src/App.tsx` imports and renders the real `Dashboard` (it already does in the Task 7 final code).

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- Dashboard`
Expected: PASS (2 tests).

- [ ] **Step 7: Verify visually**

Run: `npm run dev`, log in with `1234`, confirm the dashboard shows Total Cash `Rs 0`, the big/small cards, and the three wallets. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx src/components/StatCard.tsx src/App.tsx
git commit -m "feat: add dashboard with total cash, big/small split, and wallet balances"
```

---

### Task 9: Settings — shop name, PIN, wallets, denomination thresholds

**Files:**
- Create: `src/pages/Settings.tsx`
- Modify: `src/App.tsx` (restore real `Settings` import if placeholder was used)
- Test: `src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `useAppStore` (`updateSettings`, `upsertWallet`, `removeWallet`, `logout`), `Denomination`.
- Produces: a Settings page to edit shop name + PIN, add/rename/remove wallets, toggle each denomination's big/small flag, and log out.

- [ ] **Step 1: Write the failing test**

Create `src/pages/Settings.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import { useAppStore } from '../store/appStore'
import Settings from './Settings'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: true, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({ authed: true })
})

describe('Settings', () => {
  it('updates the shop name', async () => {
    render(<Settings />)
    const input = screen.getByLabelText(/shop name/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'Saleem PCO')
    await userEvent.click(screen.getByRole('button', { name: /save shop/i }))
    expect(useAppStore.getState().data?.settings.shopName).toBe('Saleem PCO')
  })

  it('adds a new wallet', async () => {
    render(<Settings />)
    await userEvent.type(screen.getByLabelText(/new wallet name/i), 'SadaPay')
    await userEvent.click(screen.getByRole('button', { name: /add wallet/i }))
    expect(useAppStore.getState().data?.wallets.map((w) => w.name)).toContain('SadaPay')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- Settings`
Expected: FAIL — `Cannot find module './Settings'`.

- [ ] **Step 3: Implement the Settings page**

Create `src/pages/Settings.tsx`:
```tsx
import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Denomination } from '../domain/denominations'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `w-${Date.now()}`
}

export default function Settings() {
  const data = useAppStore((s) => s.data)!
  const updateSettings = useAppStore((s) => s.updateSettings)
  const upsertWallet = useAppStore((s) => s.upsertWallet)
  const removeWallet = useAppStore((s) => s.removeWallet)
  const logout = useAppStore((s) => s.logout)

  const [shopName, setShopName] = useState(data.settings.shopName)
  const [pin, setPin] = useState(data.settings.pin)
  const [newWallet, setNewWallet] = useState('')

  function toggleBig(d: Denomination) {
    const denominations = data.settings.denominations.map((x) =>
      x.value === d.value ? { ...x, isBig: !x.isBig } : x,
    )
    updateSettings({ denominations })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="space-y-2 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Shop</h2>
        <label htmlFor="shopName" className="block text-sm">Shop name</label>
        <input
          id="shopName"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        />
        <label htmlFor="pin" className="block text-sm">Login PIN</label>
        <input
          id="pin"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          inputMode="numeric"
        />
        <button
          onClick={() => updateSettings({ shopName, pin })}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
        >
          Save shop
        </button>
      </section>

      <section className="space-y-2 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Wallets</h2>
        <ul className="space-y-1">
          {data.wallets.map((w) => (
            <li key={w.id} className="flex items-center justify-between">
              <span>{w.name}</span>
              <button
                onClick={() => removeWallet(w.id)}
                className="text-sm text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <label htmlFor="newWallet" className="block text-sm">New wallet name</label>
        <div className="flex gap-2">
          <input
            id="newWallet"
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            className="flex-1 rounded-lg border px-3 py-2"
          />
          <button
            onClick={() => {
              if (!newWallet.trim()) return
              upsertWallet({ id: slugify(newWallet), name: newWallet.trim(), balance: 0 })
              setNewWallet('')
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white"
          >
            Add wallet
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Notes — Big / Small</h2>
        <ul className="grid grid-cols-2 gap-2">
          {data.settings.denominations.map((d) => (
            <li key={d.value} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>Rs {d.value}</span>
              <button
                onClick={() => toggleBig(d)}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  d.isBig ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {d.isBig ? 'Big' : 'Small'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <button onClick={logout} className="w-full rounded-lg bg-slate-200 py-3 font-semibold">
        Logout
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- Settings`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite + build**

Run: `npm test && npm run build`
Expected: all tests PASS; `vite build` completes with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Settings.tsx src/pages/Settings.test.tsx src/App.tsx
git commit -m "feat: add settings for shop name, PIN, wallets, and note thresholds"
```

---

## Phase 1 Done — Definition

After Task 9, the app:
- Boots, persists to `localStorage`, and is PIN-protected (default `1234`).
- Shows a live dashboard: Total Cash with big/small split (currently `Rs 0` until notes exist), wallet balances, today placeholders.
- Lets the owner rename the shop, change the PIN, manage wallets, and set which notes count as big vs small.
- Has a fully unit-tested money/denomination/cash/wallet core behind a swappable `Repository` interface.

## What Phase 2 will add (not in this plan)
- Supabase adapter implementing `Repository` (cloud sync, PC↔phone) + migration SQL.
- The **New Transaction** flow with the note-picker (cash in / change out) updating wallet + cash + profit atomically, and the `cash_movements` / `note_movements` ledger that enforces the golden invariant.
- Transaction history + search.

---

## Self-Review (completed by plan author)

**Spec coverage (Phase 1 portions):**
- Cloud web app / mobile-first → Vite React app, mobile-first layout, max-width container, bottom nav. ✓ (Supabase cloud sync deferred to Phase 2 by design — Phase 1 uses localStorage so it runs with no account.)
- Single shared login → PIN gate (Task 7). ✓
- Cash note-by-note + big/small split → denominations + cash math + dashboard split (Tasks 2, 3, 8). ✓
- Wallets (Easypaisa/JazzCash/Bank) → seed + wallet math + dashboard + settings (Tasks 4, 5, 8, 9). ✓
- Configurable threshold/wallets/shop name/PIN → Settings (Task 9). ✓
- Integer-paisa money rule → `money.ts` used everywhere (Task 1). ✓
- Golden invariant → cash-total math established (Task 3); full enforcement is a Phase 2 deliverable (transactions don't exist yet). ✓ (intentional phase boundary)

**Placeholder scan:** The only "coming soon" placeholders are the `/cash` and `/wallets` routes, which are intentional phase boundaries (full Cash & Wallets screens are Phase 2+). Today-summary zeros are intentional (no transactions until Phase 2). No `TODO`/`TBD` in code.

**Type consistency:** `Paisa`, `Denomination`, `DrawerCounts`, `Wallet`, `Settings`, `AppData`, `Repository`, and store action signatures are used identically across tasks. `applyNoteDelta`, `totalCash`, `bigTotal`, `smallTotal`, `applyWalletDelta`, `profit`, `selectTotalCash/BigTotal/SmallTotal` names match between definition and use.
