import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createChromeStorageMock, installChromeStorageMock } from '@/test/chromeStorageMock'
import { SYNC_META_KEY, SYNC_FAV_PREFIX, SYNC_CHUNK_BYTES, SYNC_LOCAL_TS_KEY, SYNC_DEBOUNCE_MS } from '@/utils/constants'
import { chunkFavorites } from '@/utils/syncChunk'
import { pushOutbound, applyInbound, init, __resetSyncState } from './useConfigSync'
import type { Favorite, SyncableFavorite, SyncMeta } from '@/types'

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

function remoteFav(id: string, url = `https://${id}.com`): SyncableFavorite {
  return { id, url, title: id, addedAt: '2026-06-28T00:00:00.000Z', slot: 0 }
}

async function seedSync(
  remote: SyncableFavorite[],
  syncedAt: number,
  mock: ReturnType<typeof createChromeStorageMock>,
): Promise<void> {
  const chunks = chunkFavorites(remote, 7000)
  const payload: Record<string, unknown> = {
    [SYNC_META_KEY]: { schema: 1, syncedAt, chunks: chunks.length } as SyncMeta,
  }
  chunks.forEach((c, i) => {
    payload[`cfg_fav_${i}`] = c
  })
  await mock.sync.set(payload)
}

describe('applyInbound', () => {
  let mock: ReturnType<typeof createChromeStorageMock>
  beforeEach(() => {
    mock = createChromeStorageMock()
    installChromeStorageMock(mock)
    __resetSyncState()
  })

  it('applies newer remote, preserving local iconUrl/customLogo by id', async () => {
    await mock.local.set({
      favorites: [
        { id: '1', url: 'https://old.com', title: 'Old', addedAt: '2026-01-01T00:00:00.000Z', slot: 0, iconUrl: 'data:1', customLogo: 'data:l1' },
      ],
    })
    await seedSync([remoteFav('1', 'https://new.com')], 500, mock)
    await applyInbound()
    const { favorites } = await mock.local.get('favorites') as { favorites: Favorite[] }
    expect(favorites[0].url).toBe('https://new.com')
    expect(favorites[0].iconUrl).toBe('data:1')
    expect(favorites[0].customLogo).toBe('data:l1')
  })

  it('skips when remote is not strictly newer', async () => {
    await mock.local.set({ favorites: [localFav('1')] })
    await seedSync([remoteFav('1', 'https://remote.com')], 100, mock)
    await pushOutbound() // localLastSyncedAt 变为 now(>100)
    const before = (await mock.local.get('favorites') as { favorites: Favorite[] }).favorites
    await applyInbound()
    const after = (await mock.local.get('favorites') as { favorites: Favorite[] }).favorites
    expect(after).toEqual(before)
  })

  it('skips incomplete remote (fewer chunks than meta.chunks)', async () => {
    await mock.local.set({ favorites: [localFav('1')] })
    await mock.sync.set({ [SYNC_META_KEY]: { schema: 1, syncedAt: 999, chunks: 2 } })
    await applyInbound()
    const { favorites } = await mock.local.get('favorites') as { favorites: Favorite[] }
    expect(favorites).toHaveLength(1)
  })
})

describe('init', () => {
  let mock: ReturnType<typeof createChromeStorageMock>
  beforeEach(() => {
    vi.useFakeTimers()
    mock = createChromeStorageMock()
    installChromeStorageMock(mock)
    __resetSyncState()
  })
  afterEach(() => vi.useRealTimers())

  it('seeds sync from local when sync is empty', async () => {
    await mock.local.set({ favorites: [localFav('a'), localFav('b')] })
    await init()
    const all = await mock.sync.get(null)
    expect(all[SYNC_META_KEY]).toBeDefined()
    const ts = (await mock.local.get(SYNC_LOCAL_TS_KEY) as Record<string, number>)[SYNC_LOCAL_TS_KEY]
    expect(typeof ts).toBe('number')
  })

  it('pulls remote into empty local (fresh device)', async () => {
    await seedSync([remoteFav('a'), remoteFav('b')], 300, mock)
    await init()
    const { favorites } = await mock.local.get('favorites') as { favorites: Favorite[] }
    expect(favorites.map((f) => f.id).sort()).toEqual(['a', 'b'])
    expect(mock.sync.__logs.length).toBeLessThanOrEqual(1)
  })

  it('no-op when both empty', async () => {
    await init()
    expect((await mock.sync.get(null))[SYNC_META_KEY]).toBeUndefined()
  })

  it('pushes local-only changes when local differs from same-age remote', async () => {
    await seedSync([remoteFav('a')], 300, mock)
    await mock.local.set({ favorites: [localFav('a'), localFav('b')] })
    await mock.local.set({ [SYNC_LOCAL_TS_KEY]: 300 })
    await init()
    const all = await mock.sync.get(null)
    const recombined = Object.keys(all)
      .filter((k) => k.startsWith(SYNC_FAV_PREFIX))
      .flatMap((k) => all[k] as { id: string }[])
    expect(recombined.map((f) => f.id).sort()).toEqual(['a', 'b'])
  })

  it('wires onLocalChanged → schedulePush → outbound', async () => {
    await mock.local.set({ favorites: [localFav('a')] })
    await init()
    const writesBefore = mock.sync.__logs.length
    await mock.local.set({ favorites: [localFav('a'), localFav('b')] })
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)
    const all = await mock.sync.get(null)
    const recombined = Object.keys(all)
      .filter((k) => k.startsWith(SYNC_FAV_PREFIX))
      .flatMap((k) => all[k] as { id: string }[])
    expect(recombined).toHaveLength(2)
    expect(mock.sync.__logs.length).toBeGreaterThan(writesBefore)
  })
})
