import { ref } from 'vue'
import type { TabInfo } from '@/types'

const tabs = ref<TabInfo[]>([])

export function useChromeTabs() {
  async function load(): Promise<void> {
    const extensionId = chrome.runtime.id
    const newtabUrl = `chrome-extension://${extensionId}/index.html`

    try {
      const raw = await chrome.tabs.query({})
      tabs.value = raw.map(t => ({
        id: t.id!,
        url: t.url || '',
        title: t.title || '',
        windowId: t.windowId,
        active: t.active,
        pinned: !!t.pinned,
        lastAccessed: t.lastAccessed || 0,
        isTabHome: t.url === newtabUrl || t.url === 'chrome://newtab/',
      }))
    } catch {
      tabs.value = []
    }
  }

  async function closeByIds(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    try { await chrome.tabs.remove(ids) } catch { /* ignore */ }
    await load()
  }

  async function closeByHostnames(hostnames: string[]): Promise<void> {
    const ids = tabs.value
      .filter(t => {
        try { return hostnames.includes(new URL(t.url).hostname) } catch { return false }
      })
      .map(t => t.id)
    await closeByIds(ids)
  }

  async function closeExact(urls: string[]): Promise<void> {
    const urlSet = new Set(urls)
    const ids = tabs.value.filter(t => urlSet.has(t.url)).map(t => t.id)
    await closeByIds(ids)
  }

  async function focusTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.update(tabId, { active: true })
      const tab = await chrome.tabs.get(tabId)
      await chrome.windows.update(tab.windowId, { focused: true })
    } catch { /* ignore */ }
  }

  async function pinToggle(tabId: number): Promise<boolean> {
    try {
      const tab = await chrome.tabs.get(tabId)
      await chrome.tabs.update(tabId, { pinned: !tab.pinned })
      await load()
      return !tab.pinned
    } catch { return false }
  }

  return { tabs, load, closeByIds, closeByHostnames, closeExact, focusTab, pinToggle }
}
