import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Favorite, FavoriteFormData } from '@/types'
import { SLOT_UPPER_BOUND, TRAILING_EMPTY_BUFFER } from '@/utils/constants'

export const useFavoritesStore = defineStore('favorites', () => {
  const items = ref<Favorite[]>([])
  const isLoading = ref(false)

  const bySlotOrdered = computed(() => [...items.value].sort((a, b) => a.slot - b.slot))

  const favoritedUrls = computed(() => new Set(items.value.map(f => f.url)))

  const totalSlots = computed(() => {
    if (items.value.length === 0) return 0
    let max = 0
    for (const f of items.value) { if (f.slot > max) max = f.slot }
    return Math.min(max + 1 + TRAILING_EMPTY_BUFFER, SLOT_UPPER_BOUND)
  })

  async function load(): Promise<void> {
    isLoading.value = true
    try {
      const result = await chrome.storage.local.get('favorites')
      items.value = (result.favorites || []).filter((f: any) => f && !f.type && f.url)
      items.value.forEach((f: Favorite) => {
        if (typeof f.slot !== 'number' || f.slot < 0) f.slot = 0
      })
    } catch {
      items.value = []
    }
    isLoading.value = false
  }

  async function persist(): Promise<void> {
    try { await chrome.storage.local.set({ favorites: items.value }) } catch { /* ignore */ }
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
    items.value.push(fav)
    await persist()
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

  return { items, isLoading, bySlotOrdered, favoritedUrls, totalSlots, load, persist, add, update, remove, moveSlot, swapSlots }
})
