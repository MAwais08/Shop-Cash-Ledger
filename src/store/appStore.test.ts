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

  it('persists mutations through the repository', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)

    await useAppStore.getState().updateSettings({ shopName: 'Persisted via save' })
    const afterSettings = await repo.load()
    expect(afterSettings.settings.shopName).toBe('Persisted via save')

    await useAppStore.getState().upsertWallet({ id: 'sadapay', name: 'SadaPay', balance: 0 })
    const afterWallet = await repo.load()
    expect(afterWallet.wallets.some(w => w.id === 'sadapay')).toBe(true)
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

describe('appStore transactions', () => {
  it('addTransaction updates wallet, drawer, and appends a transaction; persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)

    await useAppStore.getState().addTransaction({
      type: 'send',
      walletId: 'jazzcash',
      walletDelta: -5000_00,
      amount: 5000_00,
      commission: 50_00,
      discount: 0,
      notesIn: { 5000: 1, 50: 1 },
      notesOut: {},
      customerName: 'Ali',
    })

    const data = useAppStore.getState().data!
    expect(data.transactions).toHaveLength(1)
    expect(data.transactions[0].id).toBeTruthy()
    expect(data.wallets.find((w) => w.id === 'jazzcash')!.balance).toBe(-5000_00)
    const reloaded = await repo.load()
    expect(reloaded.transactions).toHaveLength(1)
  })

  it('deleteTransaction reverses effects; persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    await useAppStore.getState().addTransaction({
      type: 'other',
      walletId: null,
      walletDelta: 0,
      amount: 1000_00,
      commission: 0,
      discount: 0,
      notesIn: { 1000: 1 },
      notesOut: {},
    })
    const id = useAppStore.getState().data!.transactions[0].id
    await useAppStore.getState().deleteTransaction(id)
    expect(useAppStore.getState().data!.transactions).toHaveLength(0)
    expect((await repo.load()).transactions).toHaveLength(0)
  })
})
