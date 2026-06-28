import { chunkFavorites, reassembleFavorites } from '@/utils/syncChunk'
import { toSyncableFavorite, mergeFavorites, shouldApplyRemote } from '@/utils/syncMerge'
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

interface SyncDoc {
  meta: SyncMeta | null
  favorites: SyncableFavorite[]
  complete: boolean
}

async function readSyncDoc(): Promise<SyncDoc> {
  const all = await chrome.storage.sync.get(null)
  const meta = (all[SYNC_META_KEY] as SyncMeta | undefined) ?? null
  const chunkKeys = Object.keys(all)
    .filter((k) => CHUNK_KEY_RE.test(k))
    .sort((a, b) => chunkIndex(a) - chunkIndex(b))
  const chunks = chunkKeys.map((k) => all[k] as SyncableFavorite[])
  const complete = meta ? chunks.length >= meta.chunks : false
  return { meta, favorites: reassembleFavorites(chunks), complete }
}

/** 用 remote 结构化字段重建本地 favorites（回接本地图标），更新 LWW 状态。 */
async function applyRemote(remote: SyncableFavorite[], syncedAt: number): Promise<void> {
  const { favorites } = await chrome.storage.local.get('favorites')
  const localArr: Favorite[] = Array.isArray(favorites) ? favorites : Object.values(favorites || {})
  const merged = mergeFavorites(remote, localArr)
  try {
    await chrome.storage.local.set({ favorites: merged })
    lastPushedSnapshot = snapshotOf(remote)
    localLastSyncedAt = syncedAt
  } catch (e) {
    console.warn('[sync] inbound apply failed', e)
  }
}

/** 入站：读 .sync，完整且严格更新时合并到 .local。 */
export async function applyInbound(): Promise<void> {
  const { meta, favorites: remote, complete } = await readSyncDoc()
  if (!meta || !complete) return
  if (!shouldApplyRemote(meta.syncedAt, localLastSyncedAt)) return
  await applyRemote(remote, meta.syncedAt)
}

export function useConfigSync(): { init: () => Promise<void> } {
  return { init: async () => { /* Task 7 实现 */ } }
}
