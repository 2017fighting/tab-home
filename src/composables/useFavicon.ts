import { ref } from 'vue'
import { MAX_ICON_BYTES, MAX_ICON_DIMENSION, ICON_CACHE_BATCH_DELAY } from '@/utils/constants'

const suppressRef = ref(false)
let writeQueue: Array<{ id: string; dataUrl: string }> = []
let writeTimer: ReturnType<typeof setTimeout> | null = null

export function useFavicon() {
  function getFaviconUrl(pageUrl: string, size: number = 64): string {
    if (!pageUrl) return ''
    try {
      const u = new URL(chrome.runtime.getURL('/_favicon/'))
      u.searchParams.set('pageUrl', pageUrl)
      u.searchParams.set('size', String(size))
      return u.toString()
    } catch { return '' }
  }

  function getFallbackChain(url: string): string[] {
    const chain: string[] = []
    chain.push(getFaviconUrl(url, 16))
    try {
      const u = new URL(url)
      chain.push(`${u.origin}/apple-touch-icon.png`)
      chain.push(`${u.origin}/apple-touch-icon-precomposed.png`)
    } catch { /* ignore */ }
    return chain
  }

  async function downloadAndCacheIcon(favId: string, imageUrl: string): Promise<string | null> {
    try {
      const resp = await fetch(imageUrl)
      if (!resp.ok) return null
      const blob = await resp.blob()
      const dataUrl = await blobToDataUrl(blob)
      if (!dataUrl) return null
      queueIconWrite(favId, dataUrl)
      return dataUrl
    } catch { return null }
  }

  function blobToDataUrl(blob: Blob): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(blob)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let w = img.width
        let h = img.height
        if (w > MAX_ICON_DIMENSION || h > MAX_ICON_DIMENSION) {
          const ratio = Math.min(MAX_ICON_DIMENSION / w, MAX_ICON_DIMENSION / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/png')
        resolve(dataUrl.length <= MAX_ICON_BYTES ? dataUrl : null)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    })
  }

  function queueIconWrite(favId: string, dataUrl: string) {
    writeQueue.push({ id: favId, dataUrl })
    if (writeTimer) clearTimeout(writeTimer)
    writeTimer = setTimeout(flushIconWrites, ICON_CACHE_BATCH_DELAY)
  }

  async function flushIconWrites() {
    if (writeQueue.length === 0) return
    const pending = writeQueue
    writeQueue = []
    suppressRef.value = true
    try {
      const result = await chrome.storage.local.get('favorites')
      const favorites = result.favorites || []
      let changed = false
      for (const { id, dataUrl } of pending) {
        const fav = favorites.find((f: any) => f.id === id)
        if (fav) { fav.iconUrl = dataUrl; changed = true }
      }
      if (changed) {
        await chrome.storage.local.set({ favorites })
      }
    } catch { /* ignore */ }
    suppressRef.value = false
  }

  return { suppressRef, getFaviconUrl, getFallbackChain, downloadAndCacheIcon, blobToDataUrl }
}
