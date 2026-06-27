import type { SyncableFavorite } from '@/types'

/**
 * 把 favorites 切成多个子数组，使每个子数组 JSON 序列化后 <= maxBytes。
 * 单条 favorite 不会被切断；若单条本身超 maxBytes，它独占一片（由调用方的 try/catch 兜底）。
 */
export function chunkFavorites(favorites: SyncableFavorite[], maxBytes: number): SyncableFavorite[][] {
  const chunks: SyncableFavorite[][] = []
  let current: SyncableFavorite[] = []
  let currentSize = 2 // "[]"

  const flush = (): void => {
    if (current.length > 0) {
      chunks.push(current)
      current = []
      currentSize = 2
    }
  }

  for (const fav of favorites) {
    const itemSize = JSON.stringify(fav).length + 1 // +1 for comma separator
    if (currentSize + itemSize > maxBytes && current.length > 0) flush()
    current.push(fav)
    currentSize += itemSize
  }
  flush()
  return chunks
}

export function reassembleFavorites(chunks: SyncableFavorite[][]): SyncableFavorite[] {
  return chunks.flat()
}
