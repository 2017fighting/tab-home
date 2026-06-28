import { describe, it, expect } from 'vitest'
import { toSyncableFavorite, shouldApplyRemote, mergeFavorites, unionMergeFavorites } from './syncMerge'
import type { Favorite, SyncableFavorite } from '@/types'

describe('toSyncableFavorite', () => {
  it('strips iconUrl and customLogo', () => {
    const fav: Favorite = {
      id: '1', url: 'https://x.com', title: 'X', addedAt: '2026-06-28T00:00:00.000Z', slot: 0,
      iconUrl: 'data:...', customLogo: 'data:logo...',
    }
    const syncable = toSyncableFavorite(fav)
    expect(syncable).toEqual({ id: '1', url: 'https://x.com', title: 'X', addedAt: '2026-06-28T00:00:00.000Z', slot: 0 })
    expect('iconUrl' in syncable).toBe(false)
    expect('customLogo' in syncable).toBe(false)
  })
})

describe('shouldApplyRemote', () => {
  it('applies only when remote is strictly newer', () => {
    expect(shouldApplyRemote(200, 100)).toBe(true)
    expect(shouldApplyRemote(100, 100)).toBe(false)
    expect(shouldApplyRemote(50, 100)).toBe(false)
  })
})

describe('mergeFavorites', () => {
  const local: Favorite[] = [
    { id: '1', url: 'https://old.com', title: 'Old', addedAt: '2026-01-01T00:00:00.000Z', slot: 0, iconUrl: 'data:1', customLogo: 'data:l1' },
    { id: '2', url: 'https://b.com', title: 'B', addedAt: '2026-01-02T00:00:00.000Z', slot: 1, iconUrl: 'data:2' },
  ]
  const remote: SyncableFavorite[] = [
    { id: '1', url: 'https://new.com', title: 'New', addedAt: '2026-06-28T00:00:00.000Z', slot: 0 },
    { id: '3', url: 'https://c.com', title: 'C', addedAt: '2026-06-28T00:00:00.000Z', slot: 2 },
  ]

  it('remote structured fields win, local iconUrl/customLogo preserved by id', () => {
    const merged = mergeFavorites(remote, local)
    const m1 = merged.find((f) => f.id === '1')!
    expect(m1.url).toBe('https://new.com')
    expect(m1.iconUrl).toBe('data:1')
    expect(m1.customLogo).toBe('data:l1')
  })

  it('remote-new favorites arrive bare (no icon/logo)', () => {
    const merged = mergeFavorites(remote, local)
    const m3 = merged.find((f) => f.id === '3')!
    expect(m3.url).toBe('https://c.com')
    expect('iconUrl' in m3).toBe(false)
    expect('customLogo' in m3).toBe(false)
  })

  it('locally-deleted-on-remote ids are dropped', () => {
    const merged = mergeFavorites(remote, local)
    expect(merged.find((f) => f.id === '2')).toBeUndefined()
  })
})

describe('unionMergeFavorites', () => {
  const local: Favorite[] = [
    { id: '1', url: 'https://old.com', title: 'Old', addedAt: '2026-01-01T00:00:00.000Z', slot: 0, iconUrl: 'data:1', customLogo: 'data:l1' },
    { id: '2', url: 'https://b.com', title: 'B', addedAt: '2026-01-02T00:00:00.000Z', slot: 1, iconUrl: 'data:2' },
  ]
  const remote: SyncableFavorite[] = [
    { id: '1', url: 'https://new.com', title: 'New', addedAt: '2026-06-28T00:00:00.000Z', slot: 0 },
  ]

  it('remote fields win for shared ids, local iconUrl/customLogo preserved', () => {
    const merged = unionMergeFavorites(remote, local)
    const m1 = merged.find((f) => f.id === '1')!
    expect(m1.url).toBe('https://new.com')
    expect(m1.iconUrl).toBe('data:1')
    expect(m1.customLogo).toBe('data:l1')
  })

  it('preserves local-only favorites instead of dropping them', () => {
    const merged = unionMergeFavorites(remote, local)
    expect(merged.map((f) => f.id).sort()).toEqual(['1', '2'])
    const m2 = merged.find((f) => f.id === '2')!
    expect(m2.url).toBe('https://b.com')
    expect(m2.iconUrl).toBe('data:2')
  })

  it('includes remote-new favorites (bare) alongside local', () => {
    const r = [...remote, { id: '3', url: 'https://c.com', title: 'C', addedAt: '2026-06-28T00:00:00.000Z', slot: 2 }]
    const merged = unionMergeFavorites(r, local)
    expect(merged.map((f) => f.id).sort()).toEqual(['1', '2', '3'])
  })
})
