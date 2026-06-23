import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseRepository } from './supabaseRepository'
import { seedData } from './seed'
import type { AppData } from './types'

type FakeRow = { data: AppData } | null
type FakeOpts = { selectError?: unknown; upsertError?: unknown }

/**
 * Minimal hand-written stand-in for the supabase-js client, covering exactly the
 * fluent calls SupabaseRepository uses:
 *   from(table).select(col).eq(col, val).maybeSingle()
 *   from(table).upsert(payload)
 * Backed by one in-memory row. `current()` exposes it for assertions.
 */
function fakeSupabase(initialRow: FakeRow = null, opts: FakeOpts = {}) {
  let row: FakeRow = initialRow
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: row, error: opts.selectError ?? null }),
    upsert: async (payload: { id: number; data: AppData }) => {
      if (opts.upsertError) return { data: null, error: opts.upsertError }
      row = { data: payload.data }
      return { data: null, error: null }
    },
  }
  const client = {
    from: (table: string) => {
      if (table !== 'app_state') throw new Error(`Unexpected table: ${table}`)
      return builder
    },
  } as unknown as SupabaseClient
  return { client, current: () => row }
}

describe('SupabaseRepository', () => {
  it('seeds the singleton row on first load when the table is empty', async () => {
    const { client, current } = fakeSupabase(null)
    const repo = new SupabaseRepository(client)

    const data = await repo.load()

    expect(data.settings.shopName).toBe('My PCO Shop')
    expect(data.settings.pin).toBe('1234')
    expect(data.wallets).toHaveLength(3)
    // the seed was persisted as the id=1 row
    expect(current()).not.toBeNull()
    expect(current()!.data.wallets).toHaveLength(3)
  })

  it('round-trips saved data back on the next load', async () => {
    const { client } = fakeSupabase({ data: seedData() })
    const repo = new SupabaseRepository(client)

    const data = await repo.load()
    data.settings.shopName = 'Persisted Shop'
    await repo.save(data)

    const reloaded = await repo.load()
    expect(reloaded.settings.shopName).toBe('Persisted Shop')
  })

  it('normalizes a legacy row that lacks transactions/cashMovements', async () => {
    // A row written before the transaction ledger existed.
    const legacy = {
      settings: { shopName: 'Old Shop', pin: '1234', denominations: [] },
      wallets: [],
      drawer: {},
    } as unknown as AppData
    const { client } = fakeSupabase({ data: legacy })
    const repo = new SupabaseRepository(client)

    const data = await repo.load()

    expect(data.transactions).toEqual([])
    expect(data.cashMovements).toEqual([])
    expect(data.settings.shopName).toBe('Old Shop')
  })

  it('throws when the select returns an error (fail loudly)', async () => {
    const { client } = fakeSupabase(null, { selectError: new Error('select boom') })
    const repo = new SupabaseRepository(client)

    await expect(repo.load()).rejects.toThrow('select boom')
  })

  it('throws when the upsert returns an error (fail loudly)', async () => {
    const { client } = fakeSupabase({ data: seedData() }, { upsertError: new Error('upsert boom') })
    const repo = new SupabaseRepository(client)

    await expect(repo.save(seedData())).rejects.toThrow('upsert boom')
  })

  it('throws when the seed upsert fails on first load', async () => {
    const { client } = fakeSupabase(null, { upsertError: new Error('seed upsert boom') })
    const repo = new SupabaseRepository(client)

    await expect(repo.load()).rejects.toThrow('seed upsert boom')
  })
})
