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
