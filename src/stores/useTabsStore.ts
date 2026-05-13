import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TabInfo, DomainGroup } from '@/types'
import { useChromeTabs } from '@/composables/useChromeTabs'
import { useDomainGrouping } from '@/composables/useDomainGrouping'
import { TAB_RENDER_DEBOUNCE } from '@/utils/constants'

const chromeTabs = useChromeTabs()
const { groupTabs } = useDomainGrouping()

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<TabInfo[]>([])
  const isLoading = ref(false)

  const realTabs = computed(() => tabs.value.filter(t => {
    const u = t.url || ''
    return !u.startsWith('chrome://')
      && !u.startsWith('chrome-extension://')
      && !u.startsWith('about:')
      && !u.startsWith('edge://')
      && !u.startsWith('brave://')
      && !u.startsWith('chrome-native://')
  }))

  const pinnedTabs = computed(() => realTabs.value.filter(t => t.pinned))
  const regularTabs = computed(() => realTabs.value.filter(t => !t.pinned))

  const tabHomeCount = computed(() => tabs.value.filter(t => t.isTabHome).length)

  const pinnedGroups = computed<DomainGroup[]>(() => {
    const { pinned } = groupTabs(realTabs.value)
    return pinned
  })

  const regularGroups = computed<DomainGroup[]>(() => {
    const { regular } = groupTabs(realTabs.value)
    return regular
  })

  async function load(): Promise<void> {
    await chromeTabs.load()
    tabs.value = chromeTabs.tabs.value
  }

  function debouncedLoad() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(load, TAB_RENDER_DEBOUNCE)
  }

  async function closeTabs(ids: number[]): Promise<void> {
    await chromeTabs.closeByIds(ids)
    tabs.value = chromeTabs.tabs.value
  }

  async function closeDuplicates(url: string): Promise<void> {
    const matches = realTabs.value.filter(t => t.url === url)
    if (matches.length <= 1) return
    const close = matches.slice(1)
    await closeTabs(close.map(t => t.id))
  }

  async function closeTabHomeDupes(): Promise<void> {
    const dupes = tabs.value.filter(t => t.isTabHome)
    if (dupes.length <= 1) return
    const [keep, ...close] = dupes.sort((a, b) => b.lastAccessed - a.lastAccessed)
    await closeTabs(close.map(t => t.id))
  }

  async function focusTab(tabId: number): Promise<void> {
    await chromeTabs.focusTab(tabId)
  }

  async function pinToggle(tabId: number): Promise<void> {
    await chromeTabs.pinToggle(tabId)
    tabs.value = chromeTabs.tabs.value
  }

  return { tabs, isLoading, realTabs, pinnedTabs, regularTabs, tabHomeCount, pinnedGroups, regularGroups, load, debouncedLoad, closeTabs, closeDuplicates, closeTabHomeDupes, focusTab, pinToggle }
})
