import type { AppData } from './types'

export interface Repository {
  load(): Promise<AppData>
  save(data: AppData): Promise<void>
}
