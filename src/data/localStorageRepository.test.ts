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

  it('recovers from corrupt localStorage by backing up and reseeding', async () => {
    localStorage.setItem('pco_app_data', '{bad json')
    const data = await new LocalStorageRepository().load()
    expect(data.settings.pin).toBe('1234')
    expect(data.wallets).toHaveLength(3)
    expect(localStorage.getItem('pco_app_data_corrupt')).toBe('{bad json')
    expect(JSON.parse(localStorage.getItem('pco_app_data')!).settings.pin).toBe('1234')
  })

  it('normalizes legacy data that lacks transactions/cashMovements arrays', async () => {
    // A Phase-1 payload saved before the transaction ledger existed.
    localStorage.setItem(
      'pco_app_data',
      JSON.stringify({
        settings: { shopName: 'Old Shop', pin: '1234', denominations: [] },
        wallets: [],
        drawer: {},
      }),
    )
    const data = await new LocalStorageRepository().load()
    expect(data.transactions).toEqual([])
    expect(data.cashMovements).toEqual([])
    expect(data.settings.shopName).toBe('Old Shop')
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
