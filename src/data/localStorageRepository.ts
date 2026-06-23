import type { Repository } from './repository'
import type { AppData } from './types'
import { seedData } from './seed'
import { normalizeAppData } from './normalize'

const STORAGE_KEY = 'pco_app_data'

export class LocalStorageRepository implements Repository {
  async load(): Promise<AppData> {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seeded = seedData()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
    try {
      return normalizeAppData(JSON.parse(raw) as AppData)
    } catch {
      localStorage.setItem(`${STORAGE_KEY}_corrupt`, raw)
      const seeded = seedData()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
  }

  async save(data: AppData): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}
