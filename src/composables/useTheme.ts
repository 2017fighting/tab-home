import { ref } from 'vue'
import type { Theme } from '@/types'

const mode = ref<Theme>('light')

export function useTheme() {
  async function load(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('theme')
      const t = result.theme === 'dark' ? 'dark' : 'light'
      mode.value = t
      document.documentElement.dataset.theme = t
    } catch {
      mode.value = 'light'
      document.documentElement.dataset.theme = 'light'
    }
  }

  async function toggle(): Promise<void> {
    const next = mode.value === 'dark' ? 'light' : 'dark'
    mode.value = next
    document.documentElement.dataset.theme = next
    try { await chrome.storage.local.set({ theme: next }) } catch { /* ignore */ }
  }

  return { mode, load, toggle }
}
