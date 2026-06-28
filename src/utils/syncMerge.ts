import type { Favorite, SyncableFavorite } from '@/types'

export function toSyncableFavorite(f: Favorite): SyncableFavorite {
  return { id: f.id, url: f.url, title: f.title, addedAt: f.addedAt, slot: f.slot }
}

export function shouldApplyRemote(remoteSyncedAt: number, localLastSyncedAt: number): boolean {
  return remoteSyncedAt > localLastSyncedAt
}

/**
 * 用 remote 结构化字段重建 favorites，按 id 回接本地 iconUrl/customLogo。
 * 远端新增 → 裸数据；远端缺失的本地 id → 丢弃（LWW 删除传播）。
 */
export function mergeFavorites(remote: SyncableFavorite[], local: Favorite[]): Favorite[] {
  const localById = new Map(local.map((f) => [f.id, f]))
  return remote.map((r) => {
    const existing = localById.get(r.id)
    return existing ? { ...existing, ...r } : ({ ...r } as Favorite)
  })
}

/**
 * 并集合并：remote 字段对共享 id 获胜（回接本地图标），本地独有项保留。
 * 用于 init 拉取——避免「本地有、远端还没」的新增被 LWW 重建丢掉。
 * 代价：另一端删除的项，若本机仍持有，会在 init 后被复活并回推（单用户可接受的边界）。
 * 运行时实时入站仍用 mergeFavorites（LWW 重建），让删除正常传播。
 */
export function unionMergeFavorites(remote: SyncableFavorite[], local: Favorite[]): Favorite[] {
  const localById = new Map(local.map((f) => [f.id, f]))
  const result: Favorite[] = remote.map((r) => {
    const existing = localById.get(r.id)
    return existing ? { ...existing, ...r } : ({ ...r } as Favorite)
  })
  const remoteIds = new Set(remote.map((r) => r.id))
  for (const f of local) {
    if (!remoteIds.has(f.id)) result.push(f)
  }
  return result
}
