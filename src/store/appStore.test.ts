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
    expect(data.cashMovements).toHaveLength(1)
    expect(data.cashMovements[0].sourceType).toBe('kharcha')
    expect(data.cashMovements[0].delta).toBe(-300_00)
    expect((await repo.load()).expenses).toHaveLength(1)
  })

  it('addExpense (wallet) reduces wallet balance, no CashMovement added', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)

    await useAppStore.getState().addExpense({
      category: 'Rent',
      amount: 5000_00,
      payment: 'wallet',
      walletId: 'easypaisa',
      notesOut: {},
    })

    const data = useAppStore.getState().data!
    expect(data.expenses).toHaveLength(1)
    expect(data.wallets.find((w) => w.id === 'easypaisa')!.balance).toBe(-5000_00)
    expect(data.cashMovements).toHaveLength(0)
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
    expect((await repo.load()).expenses).toHaveLength(0)
  })
})

describe('appStore count', () => {
  it('recordCount with a difference updates drawer + counts + a count movement; persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } }) // Rs 5000

    await useAppStore.getState().recordCount({ countedNotes: { 1000: 4 }, note: 'short' }) // Rs 4000

    const data = useAppStore.getState().data!
    expect(data.counts).toHaveLength(1)
    expect(data.counts[0].difference).toBe(-1000_00)
    expect(data.drawer[1000]).toBe(4)
    expect(data.cashMovements).toHaveLength(1)
    expect(data.cashMovements[0].sourceType).toBe('count')
    expect(data.cashMovements[0].delta).toBe(-1000_00)
    const reloaded = await repo.load()
    expect(reloaded.counts).toHaveLength(1)
  })

  it('recordCount with a matched count records a snapshot but no movement', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } })

    await useAppStore.getState().recordCount({ countedNotes: { 1000: 5 } })

    const data = useAppStore.getState().data!
    expect(data.counts).toHaveLength(1)
    expect(data.counts[0].difference).toBe(0)
    expect(data.cashMovements).toHaveLength(0)
  })
})

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
    expect(data.cashMovements).toHaveLength(1)
    expect(data.cashMovements[0].sourceType).toBe('udhar')
    expect(data.cashMovements[0].delta).toBe(-2000_00)
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

  it('updatePerson changes name and persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)

    const id = await useAppStore.getState().addPerson('Ali')
    await useAppStore.getState().updatePerson(id, { name: 'Ahmed' })

    const person = useAppStore.getState().data!.persons.find((p) => p.id === id)
    expect(person?.name).toBe('Ahmed')
    expect((await repo.load()).persons.find((p) => p.id === id)?.name).toBe('Ahmed')
  })
})

describe('appStore adjustments', () => {
  it('addAdjustment (cash) raises drawer, logs adjustment movement, persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } })

    await useAppStore.getState().addAdjustment({ cashNotes: { 1000: 2 } })

    const data = useAppStore.getState().data!
    expect(data.adjustments).toHaveLength(1)
    expect(data.adjustments[0].id).toBeTruthy()
    expect(data.drawer[1000]).toBe(7)
    expect(data.cashMovements).toHaveLength(1)
    expect(data.cashMovements[0].sourceType).toBe('adjustment')
    expect(data.cashMovements[0].delta).toBe(2000_00)
    const reloaded = await repo.load()
    expect(reloaded.adjustments).toHaveLength(1)
  })

  it('addAdjustment (wallet) raises wallet balance, no CashMovement, persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)

    await useAppStore.getState().addAdjustment({ walletId: 'easypaisa', walletDelta: 5000_00 })

    const data = useAppStore.getState().data!
    expect(data.adjustments).toHaveLength(1)
    expect(data.wallets.find((w) => w.id === 'easypaisa')!.balance).toBe(5000_00)
    expect(data.cashMovements).toHaveLength(0)
    const reloaded = await repo.load()
    expect(reloaded.adjustments).toHaveLength(1)
  })

  it('deleteAdjustment reverses effects and persists', async () => {
    const repo = new InMemoryRepository(seedData())
    useAppStore.setState({ data: null, authed: false, repo: null })
    await useAppStore.getState().init(repo)
    useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } })

    await useAppStore.getState().addAdjustment({ cashNotes: { 1000: 2 } })
    const id = useAppStore.getState().data!.adjustments[0].id
    await useAppStore.getState().deleteAdjustment(id)

    const data = useAppStore.getState().data!
    expect(data.adjustments).toHaveLength(0)
    expect(data.drawer[1000]).toBe(5)
    expect(data.cashMovements).toHaveLength(0)
    const reloaded = await repo.load()
    expect(reloaded.adjustments).toHaveLength(0)
  })
})
