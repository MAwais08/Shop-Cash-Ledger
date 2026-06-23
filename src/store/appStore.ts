import { create } from 'zustand'
import type { Repository } from '../data/repository'
import type { AppData, Settings } from '../data/types'
import type { Wallet } from '../domain/wallet'
import type { Paisa } from '../domain/money'
import { totalCash, bigTotal, smallTotal } from '../domain/cash'
import { applyTransaction, deleteTransaction as deleteTxnDomain } from '../domain/transaction'
import type { TransactionInput } from '../domain/transaction'
import { applyExpense, deleteExpense as deleteExpenseDomain } from '../domain/expense'
import type { ExpenseInput } from '../domain/expense'

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
  addTransaction: (input: Omit<TransactionInput, 'id' | 'createdAt'>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  addExpense: (input: Omit<ExpenseInput, 'id' | 'createdAt'>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
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

  async addTransaction(input) {
    const { repo, data } = get()
    if (!repo || !data) return
    const full: TransactionInput = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    const next = applyTransaction(data, full)
    await repo.save(next)
    set({ data: next })
  },

  async deleteTransaction(id) {
    const { repo, data } = get()
    if (!repo || !data) return
    const next = deleteTxnDomain(data, id)
    await repo.save(next)
    set({ data: next })
  },

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
}))

export const selectTotalCash = (s: AppState): Paisa =>
  s.data ? totalCash(s.data.drawer) : 0
export const selectBigTotal = (s: AppState): Paisa =>
  s.data ? bigTotal(s.data.drawer, s.data.settings.denominations) : 0
export const selectSmallTotal = (s: AppState): Paisa =>
  s.data ? smallTotal(s.data.drawer, s.data.settings.denominations) : 0

// Note: today's summary is intentionally NOT a store selector. A selector that
// returns a fresh object each call triggers infinite re-renders under Zustand v5.
// Dashboard derives it with useMemo over s.data.transactions instead.
