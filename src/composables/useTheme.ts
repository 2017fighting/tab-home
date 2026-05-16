import { ref } from 'vue'
import type { Theme } from '@/types'

const mode = ref<Theme>('light')

function apply(t: Theme) {
  mode.value = t
  document.documentElement.classList.toggle('latte', t === 'light')
  document.documentElement.classList.toggle('mocha', t === 'dark')
  document.documentElement.style.colorScheme = t === 'dark' ? 'dark' : 'light'
}

export function useTheme() {
  async function load(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('theme')
      apply(result.theme === 'dark' ? 'dark' : 'light')
    } catch {
      apply('light')
    }
  }

  async function toggle(): Promise<void> {
    apply(mode.value === 'dark' ? 'light' : 'dark')
    try { await chrome.storage.local.set({ theme: mode.value }) } catch { /* ignore */ }
  }

  return { mode, load, toggle, apply }
}
