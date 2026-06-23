import type { SupabaseClient } from '@supabase/supabase-js'
import type { Repository } from './repository'
import type { AppData } from './types'
import { seedData } from './seed'
import { normalizeAppData } from './normalize'

const TABLE = 'app_state'
const SINGLETON_ID = 1

export class SupabaseRepository implements Repository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async load(): Promise<AppData> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('data')
      .eq('id', SINGLETON_ID)
      .maybeSingle()
    if (error) throw error

    const row = data as { data: AppData } | null
    if (!row) {
      const seeded = seedData()
      const { error: insertError } = await this.client
        .from(TABLE)
        .upsert({ id: SINGLETON_ID, data: seeded })
      if (insertError) throw insertError
      return seeded
    }
    return normalizeAppData(row.data)
  }

  async save(data: AppData): Promise<void> {
    const { error } = await this.client.from(TABLE).upsert({ id: SINGLETON_ID, data })
    if (error) throw error
  }
}
