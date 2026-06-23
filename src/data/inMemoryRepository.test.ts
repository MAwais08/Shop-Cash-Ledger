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
