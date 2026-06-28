import { chunkFavorites, reassembleFavorites } from '@/utils/syncChunk'
import { toSyncableFavorite } from '@/utils/syncMerge'
import {
  SYNC_CHUNK_BYTES,
  SYNC_DEBOUNCE_MS,
  SYNC_FAV_PREFIX,
  SYNC_META_KEY,
} from '@/utils/constants'
import type { Favorite, SyncableFavorite, SyncMeta } from '@/types'

const CHUNK_KEY_RE = /^cfg_fav_\d+$/
const chunkIndex = (k: string): number => parseInt(k.slice(SYNC_FAV_PREFIX.length), 10)

let localLastSyncedAt = 0
let lastPushedSnapshot = ''
let pushTimer: ReturnType<typeof setTimeout> | null = null

/** 仅测试用：重置模块状态。 */
export function __resetSyncState(): void {
  localLastSyncedAt = 0
  lastPushedSnapshot = ''
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
}

async function readLocalFavorites(): Promise<Favorite[]> {
  const { favorites } = await chrome.storage.local.get('favorites')
  return Array.isArray(favorites) ? favorites : Object.values(favorites || {})
}

async function readExistingChunkKeys(): Promise<string[]> {
  const all = await chrome.storage.sync.get(null)
  return Object.keys(all).filter((k) => CHUNK_KEY_RE.test(k))
}

function snapshotOf(syncable: SyncableFavorite[]): string {
  return JSON.stringify(syncable)
}

/** 把本地 favorites 剥离后分片写入 .sync（diff 跳过 + 失败静默）。 */
export async function pushOutbound(): Promise<void> {
  const local = await readLocalFavorites()
  const syncable = local.map(toSyncableFavorite)
  const snapshot = snapshotOf(syncable)
  if (snapshot === lastPushedSnapshot) return

  const chunks = chunkFavorites(syncable, SYNC_CHUNK_BYTES)
  const now = Date.now()
  const meta: SyncMeta = { schema: 1, syncedAt: now, chunks: chunks.length }
  const payload: Record<string, unknown> = { [SYNC_META_KEY]: meta }
  chunks.forEach((c, i) => {
    payload[`${SYNC_FAV_PREFIX}${i}`] = c
  })
  const stale = (await readExistingChunkKeys()).filter((k) => chunkIndex(k) >= chunks.length)

  try {
    await chrome.storage.sync.set(payload)
    if (stale.length > 0) await chrome.storage.sync.remove(stale)
    lastPushedSnapshot = snapshot
    localLastSyncedAt = now
  } catch (e) {
    console.warn('[sync] outbound push failed (sync unavailable or quota exceeded)', e)
  }
}

/** 防抖触发出站。 */
export function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushOutbound()
  }, SYNC_DEBOUNCE_MS)
}

// reassembleFavorites 在 Task 6 的 readSyncDoc 中使用；先引用，Task 6 删除该占位。
void reassembleFavorites

export function useConfigSync(): { init: () => Promise<void> } {
  return { init: async () => { /* Task 7 实现 */ } }
}
