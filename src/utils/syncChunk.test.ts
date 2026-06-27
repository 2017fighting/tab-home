import { describe, it, expect } from 'vitest'
import { chunkFavorites, reassembleFavorites } from './syncChunk'
import type { SyncableFavorite } from '@/types'

function fav(id: string): SyncableFavorite {
  return { id, url: `https://${id}.example.com`, title: id, addedAt: '2026-06-28T00:00:00.000Z', slot: 0 }
}

describe('chunkFavorites', () => {
  it('returns one chunk when everything fits', () => {
    const chunks = chunkFavorites([fav('a'), fav('b')], 7000)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(2)
  })

  it('splits into multiple chunks under the byte budget', () => {
    const many = Array.from({ length: 100 }, (_, i) => fav(`id-${i}`))
    const chunks = chunkFavorites(many, 7000)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(JSON.stringify(c).length).toBeLessThanOrEqual(7000)
    }
  })

  it('never splits a single favorite across chunks', () => {
    const chunks = chunkFavorites([fav('a'), fav('b'), fav('c')], 120)
    const recombined = reassembleFavorites(chunks)
    expect(recombined.map((f) => f.id).sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('reassembleFavorites', () => {
  it('round-trips chunked favorites', () => {
    const original = Array.from({ length: 30 }, (_, i) => fav(`id-${i}`))
    const recombined = reassembleFavorites(chunkFavorites(original, 7000))
    expect(recombined).toEqual(original)
  })
})
