import { describe, it, expect, beforeEach } from 'vitest'
import { createChromeStorageMock, installChromeStorageMock } from '@/test/chromeStorageMock'
import { SYNC_META_KEY, SYNC_FAV_PREFIX, SYNC_CHUNK_BYTES } from '@/utils/constants'
import { pushOutbound, __resetSyncState } from './useConfigSync'
import type { Favorite } from '@/types'

function localFav(id: string): Favorite {
  return { id, url: `https://${id}.com`, title: id, addedAt: '2026-06-28T00:00:00.000Z', slot: 0, iconUrl: `data:${id}` }
}

describe('pushOutbound', () => {
  let mock: ReturnType<typeof createChromeStorageMock>
  beforeEach(async () => {
    mock = createChromeStorageMock()
    installChromeStorageMock(mock)
    __resetSyncState()
    await mock.local.set({ favorites: [localFav('a'), localFav('b')] })
  })

  it('writes chunked stripped favorites + meta to sync', async () => {
    await pushOutbound()
    const all = await mock.sync.get(null)
    const meta = all[SYNC_META_KEY] as { schema: number; syncedAt: number; chunks: number }
    expect(meta.schema).toBe(1)
    expect(meta.chunks).toBeGreaterThanOrEqual(1)
    const chunkKeys = Object.keys(all).filter((k) => k.startsWith(SYNC_FAV_PREFIX)).sort()
    const recombined = chunkKeys.flatMap((k) => all[k] as unknown[])
    expect(recombined).toHaveLength(2)
    expect(recombined[0]).not.toHaveProperty('iconUrl')
    expect(recombined[0]).not.toHaveProperty('customLogo')
  })

  it('keeps every chunk under the byte budget', async () => {
    const many = Array.from({ length: 40 }, (_, i) => localFav(`id-${i}`))
    await mock.local.set({ favorites: many })
    await pushOutbound()
    const all = await mock.sync.get(null)
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(SYNC_FAV_PREFIX)) expect(JSON.stringify(v).length).toBeLessThanOrEqual(SYNC_CHUNK_BYTES)
    }
  })

  it('skips writing when the stripped snapshot is unchanged', async () => {
    await pushOutbound()
    const writesAfterFirst = mock.sync.__logs.length
    await pushOutbound()
    expect(mock.sync.__logs.length).toBe(writesAfterFirst)
  })

  it('writes again when content changes', async () => {
    await pushOutbound()
    const writesAfterFirst = mock.sync.__logs.length
    await mock.local.set({ favorites: [localFav('a'), localFav('b'), localFav('c')] })
    await pushOutbound()
    expect(mock.sync.__logs.length).toBeGreaterThan(writesAfterFirst)
  })

  it('prunes stale higher-index chunks when count shrinks', async () => {
    const many = Array.from({ length: 80 }, (_, i) => localFav(`id-${i}`))
    await mock.local.set({ favorites: many })
    await pushOutbound()
    const bigChunkCount = Object.keys(await mock.sync.get(null)).filter((k) => k.startsWith(SYNC_FAV_PREFIX)).length
    await mock.local.set({ favorites: [localFav('only')] })
    await pushOutbound()
    const all = await mock.sync.get(null)
    const remaining = Object.keys(all).filter((k) => k.startsWith(SYNC_FAV_PREFIX))
    const meta = all[SYNC_META_KEY] as { chunks: number }
    expect(remaining.length).toBe(meta.chunks)
    expect(meta.chunks).toBeLessThan(bigChunkCount)
  })
})
