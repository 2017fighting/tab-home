<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useTheme } from '@/composables/useTheme'
import { useFavoritesStore } from '@/stores/useFavoritesStore'
import { useTabsStore } from '@/stores/useTabsStore'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import AppToast from '@/components/layout/AppToast.vue'
import FavoritesColumn from '@/components/favorites/FavoritesColumn.vue'
import TabsColumn from '@/components/tabs/TabsColumn.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const { loadLang } = useI18n()
const { load: loadTheme } = useTheme()
const favStore = useFavoritesStore()
const tabsStore = useTabsStore()

onMounted(async () => {
  await loadLang()
  await loadTheme()
  await Promise.all([favStore.load(), tabsStore.load()])
  document.documentElement.lang = useI18n().lang.value === 'zh' ? 'zh' : 'en'

  // Tab and storage event listeners
  chrome.tabs.onCreated.addListener(() => tabsStore.debouncedLoad())
  chrome.tabs.onRemoved.addListener(() => tabsStore.debouncedLoad())
  chrome.tabs.onUpdated.addListener((_id, changeInfo) => {
    if (changeInfo.url || changeInfo.title || 'pinned' in changeInfo) {
      tabsStore.debouncedLoad()
    }
  })
  chrome.tabs.onMoved.addListener(() => tabsStore.debouncedLoad())
  chrome.tabs.onActivated.addListener(() => tabsStore.debouncedLoad())

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (changes.favorites) {
      console.log('[onChanged] favorites changed, suppressSync:', favStore.suppressSync, 'newValue:', changes.favorites.newValue)
      if (!favStore.suppressSync) {
        const v = changes.favorites.newValue
        const raw = Array.isArray(v) ? v : Object.values(v || {})
        console.log('[onChanged] overwriting items with:', raw.length)
        favStore.items = raw.filter((f: any) => f && (f.type !== 'folder') && f.url)
      }
    }
    if (changes.lang) {
      useI18n().lang.value = changes.lang.newValue
    }
    if (changes.theme) {
      useTheme().mode.value = changes.theme.newValue
    }
  })
})

onUnmounted(() => {
  // Chrome listeners persist for the page lifetime, no cleanup needed
})
</script>

<template>
  <div class="container">
    <AppHeader />
    <div class="dashboard-columns">
      <FavoritesColumn />
      <TabsColumn />
    </div>
    <AppFooter />
  </div>
  <ConfirmDialog />
  <AppToast />
</template>
