import { chunkFavorites, reassembleFavorites } from '@/utils/syncChunk'
import { toSyncableFavorite, mergeFavorites, shouldApplyRemote } from '@/utils/syncMerge'
import {
  SYNC_CHUNK_BYTES,
  SYNC_DEBOUNCE_MS,
  SYNC_FAV_PREFIX,
  SYNC_LOCAL_TS_KEY,
  SYNC_META_KEY,
} from '@/utils/constants'
import type { Favorite, SyncableFavorite, SyncMeta } from '@/types'

const CHUNK_KEY_RE = /^cfg_fav_\d+$/
const chunkIndex = (k: string): number => parseInt(k.slice(SYNC_FAV_PREFIX.length), 10)

let localLastSyncedAt = 0
let lastPushedSnapshot = ''
let lastPushedTheme: string | undefined
let lastPushedLang: string | undefined
let pushTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

/** 仅测试用：重置模块状态。 */
export function __resetSyncState(): void {
  localLastSyncedAt = 0
  lastPushedSnapshot = ''
  lastPushedTheme = undefined
  lastPushedLang = undefined
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  initialized = false
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
  if (syncable.length === 0 && lastPushedSnapshot === '') return // no-op only for never-pushed fresh state; deleting all must still propagate

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
    void persistLocalTs()
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
    void persistLocalTs()
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

async function pushThemeLang(): Promise<void> {
  const { theme, lang } = await chrome.storage.local.get(['theme', 'lang'])
  const payload: Record<string, unknown> = {}
  if (theme !== undefined && theme !== lastPushedTheme) payload.theme = theme
  if (lang !== undefined && lang !== lastPushedLang) payload.lang = lang
  if (Object.keys(payload).length === 0) return
  try {
    await chrome.storage.sync.set(payload)
    if (payload.theme !== undefined) lastPushedTheme = payload.theme as string
    if (payload.lang !== undefined) lastPushedLang = payload.lang as string
  } catch (e) {
    console.warn('[sync] theme/lang push failed', e)
  }
}

async function applyInboundThemeLang(): Promise<void> {
  const remote = await chrome.storage.sync.get(['theme', 'lang'])
  const local = await chrome.storage.local.get(['theme', 'lang'])
  const patch: Record<string, unknown> = {}
  if (remote.theme !== undefined && remote.theme !== local.theme) patch.theme = remote.theme
  if (remote.lang !== undefined && remote.lang !== local.lang) patch.lang = remote.lang
  if (Object.keys(patch).length === 0) return
  try {
    await chrome.storage.local.set(patch)
    if (patch.theme !== undefined) lastPushedTheme = patch.theme as string
    if (patch.lang !== undefined) lastPushedLang = patch.lang as string
  } catch (e) {
    console.warn('[sync] inbound theme/lang apply failed', e)
  }
}

async function persistLocalTs(): Promise<void> {
  try {
    await chrome.storage.local.set({ [SYNC_LOCAL_TS_KEY]: localLastSyncedAt })
  } catch {
    /* ignore */
  }
}

async function loadLocalTs(): Promise<number> {
  const { [SYNC_LOCAL_TS_KEY]: ts } = await chrome.storage.local.get(SYNC_LOCAL_TS_KEY)
  return typeof ts === 'number' ? ts : 0
}

function onLocalChanged(changes: Record<string, { newValue?: unknown }>, area: string): void {
  if (area !== 'local') return
  if ('favorites' in changes) schedulePush()
  if ('theme' in changes || 'lang' in changes) void pushThemeLang()
}

function onSyncChanged(_changes: Record<string, { newValue?: unknown }>, area: string): void {
  if (area !== 'sync') return
  void applyInbound()
  void applyInboundThemeLang()
}

export async function init(): Promise<void> {
  if (initialized) return
  initialized = true

  chrome.storage.onChanged.addListener(onLocalChanged)
  chrome.storage.onChanged.addListener(onSyncChanged)

  localLastSyncedAt = await loadLocalTs()
  const { meta, favorites: remote, complete } = await readSyncDoc()

  if (meta && complete) {
    lastPushedSnapshot = snapshotOf(remote)
    if (shouldApplyRemote(meta.syncedAt, localLastSyncedAt)) {
      await applyRemote(remote, meta.syncedAt)
    }
  } else {
    lastPushedSnapshot = ''
  }

  await pushOutbound() // 补推本地差异（离线/SW 写入）；diff 跳过保证幂等
  await pushThemeLang()
  await persistLocalTs()
}

export function useConfigSync(): { init: () => Promise<void> } {
  return { init }
}
