import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Favorite, FavoriteFormData } from '@/types'
import { SLOT_UPPER_BOUND, TRAILING_EMPTY_BUFFER } from '@/utils/constants'

export const useFavoritesStore = defineStore('favorites', () => {
  const items = ref<Favorite[]>([])
  const isLoading = ref(false)
  const suppressSync = ref(false)

  const arr = computed(() => Array.isArray(items.value) ? items.value : [])

  const bySlotOrdered = computed(() => [...arr.value].sort((a, b) => a.slot - b.slot))

  const favoritedUrls = computed(() => new Set(arr.value.map(f => f.url)))

  const totalSlots = computed(() => {
    if (arr.value.length === 0) return 0
    let max = 0
    for (const f of arr.value) { if (f.slot > max) max = f.slot }
    return Math.min(max + 1 + TRAILING_EMPTY_BUFFER, SLOT_UPPER_BOUND)
  })

  async function load(): Promise<void> {
    isLoading.value = true
    try {
      const result = await chrome.storage.local.get('favorites')
      const raw = result.favorites
      console.log('[favStore.load] raw from storage:', raw)
      // Handle both array format and object-with-numeric-keys format
      const arr = Array.isArray(raw) ? raw : Object.values(raw || {})
      const filtered = arr.filter((f: any) => f && (f.type !== 'folder') && f.url)
      console.log('[favStore.load] after filter:', filtered)
      filtered.forEach((f: Favorite) => {
        if (typeof f.slot !== 'number' || f.slot < 0) f.slot = 0
      })
      items.value = filtered
      console.log('[favStore.load] items.value:', items.value)
    } catch (e) {
      console.error('[favStore.load] error:', e)
      items.value = []
    }
    isLoading.value = false
  }

  async function persist(): Promise<void> {
    suppressSync.value = true
    try {
      const plain = JSON.parse(JSON.stringify(items.value))
      await chrome.storage.local.set({ favorites: plain })
    } catch { /* ignore */ }
    setTimeout(() => { suppressSync.value = false }, 0)
  }

  async function add(form: FavoriteFormData): Promise<boolean> {
    const exists = items.value.some(f => f.url === form.url)
    if (exists) return false

    let maxSlot = -1
    for (const f of items.value) { if (f.slot > maxSlot) maxSlot = f.slot }

    const fav: Favorite = {
      id: Date.now().toString(),
      url: form.url,
      title: form.title || form.url,
      addedAt: new Date().toISOString(),
      slot: maxSlot + 1,
      customLogo: form.customLogo || undefined,
    }
    items.value = [...items.value, fav]
    console.log('[favStore.add] items after add, before persist:', items.value.length)
    await persist()
    console.log('[favStore.add] after persist:', items.value.length)
    return true
  }

  async function update(id: string, form: FavoriteFormData): Promise<void> {
    const fav = items.value.find(f => f.id === id)
    if (!fav) return
    fav.url = form.url
    fav.title = form.title || form.url
    if (typeof form.customLogo === 'string') {
      fav.customLogo = form.customLogo
    } else if (form.customLogo === null) {
      delete fav.customLogo
      delete fav.iconUrl
    }
    await persist()
  }

  async function removeByUrl(url: string): Promise<void> {
    items.value = items.value.filter(f => f.url !== url)
    await persist()
  }

  async function remove(id: string): Promise<void> {
    items.value = items.value.filter(f => f.id !== id)
    await persist()
  }

  async function moveSlot(id: string, newSlot: number): Promise<void> {
    const fav = items.value.find(f => f.id === id)
    if (!fav) return
    fav.slot = newSlot
    await persist()
  }

  async function swapSlots(idA: string, idB: string): Promise<void> {
    const a = items.value.find(f => f.id === idA)
    const b = items.value.find(f => f.id === idB)
    if (!a || !b) return
    const tmp = a.slot
    a.slot = b.slot
    b.slot = tmp
    await persist()
  }

  return { items, isLoading, suppressSync, bySlotOrdered, favoritedUrls, totalSlots, load, persist, add, update, remove, removeByUrl, moveSlot, swapSlots }
})
