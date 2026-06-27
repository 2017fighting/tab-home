import { describe, it, expect } from 'vitest'
import { createChromeStorageMock, installChromeStorageMock } from './chromeStorageMock'

describe('vitest sanity', () => {
  it('mock stores and reads values', async () => {
    const mock = createChromeStorageMock()
    installChromeStorageMock(mock)
    await mock.local.set({ favorites: [{ id: '1' }] })
    const { favorites } = await mock.local.get('favorites')
    expect(favorites).toEqual([{ id: '1' }])
    expect(mock.local.__logs).toHaveLength(1)
  })
})
