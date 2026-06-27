import type { Favorite } from './favorite'
import type { Theme } from './theme'
import type { LangCode } from './i18n'

export interface StorageSchema {
  favorites: Favorite[]
  theme: Theme
  lang: LangCode
}

export type StorageKey = keyof StorageSchema

export type SyncableFavorite = Pick<Favorite, 'id' | 'url' | 'title' | 'addedAt' | 'slot'>

export interface SyncMeta {
  schema: number
  syncedAt: number
  chunks: number
}
