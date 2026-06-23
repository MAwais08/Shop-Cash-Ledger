import type { Repository } from './repository'
import type { AppData } from './types'
import { normalizeAppData } from './normalize'

function clone(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data))
}

export class InMemoryRepository implements Repository {
  private data: AppData

  constructor(initial: AppData) {
    this.data = clone(initial)
  }

  async load(): Promise<AppData> {
    return normalizeAppData(clone(this.data))
  }

  async save(data: AppData): Promise<void> {
    this.data = clone(data)
  }
}
