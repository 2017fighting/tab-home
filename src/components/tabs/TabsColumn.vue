<script setup lang="ts">
import { computed } from 'vue'
import type { TabInfo } from '@/types'
import { useTabsStore } from '@/stores/useTabsStore'
import { useFavoritesStore } from '@/stores/useFavoritesStore'
import { useI18n } from '@/composables/useI18n'
import { useConfetti } from '@/composables/useConfetti'
import { useSwooshSound } from '@/composables/useSwooshSound'
import { useToast } from '@/composables/useToast'
import DomainCardSection from './DomainCardSection.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const tabsStore = useTabsStore()
const favStore = useFavoritesStore()
const { t } = useI18n()
const { shoot: confetti } = useConfetti()
const { play: swoosh } = useSwooshSound()
const { show: showToast } = useToast()

const dupeMap = computed(() => {
  const map = new Map<string, number>()
  for (const t of tabsStore.realTabs) {
    map.set(t.url, (map.get(t.url) || 0) + 1)
  }
  return map
})

async function handleClose(tabId: number) {
  swoosh()
  const el = document.querySelector(`[data-tab-id="${tabId}"]`)
  if (el) {
    const rect = el.getBoundingClientRect()
    confetti(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }
  await tabsStore.closeTabs([tabId])
  showToast(t('tabClosed'))
}

async function handlePin(tabId: number) {
  await tabsStore.pinToggle(tabId)
}

async function handleFavorite(tab: TabInfo) {
  if (favStore.favoritedUrls.has(tab.url)) {
    showToast(t('alreadyAdded'))
    return
  }
  const ok = await favStore.add({ url: tab.url, title: tab.title })
  if (ok) showToast(t('addedToFavorites'))
  else showToast(t('alreadyAdded'))
}

async function handleDedup(url: string) {
  await tabsStore.closeDuplicates(url)
  showToast(t('closedDupes'))
}

async function handleCloseDomain(domain: string) {
  const group = [...tabsStore.pinnedGroups, ...tabsStore.regularGroups].find(g => g.domain === domain)
  if (!group) return
  await tabsStore.closeTabs(group.tabs.map(t => t.id))
  showToast(t('closedNFromX', group.tabs.length, group.label || domain))
}

async function handleCloseAll() {
  const ids = tabsStore.realTabs.map(t => t.id)
  if (ids.length === 0) return
  await tabsStore.closeTabs(ids)
  showToast(t('allTabsClosed'))
}
</script>

<template>
  <div class="active-section" id="openTabsSection">
    <DomainCardSection
      :groups="tabsStore.pinnedGroups"
      :favorited-urls="favStore.favoritedUrls"
      :dupe-map="dupeMap"
      :section-title="t('pinned')"
      @focus="tabsStore.focusTab($event)"
      @close="handleClose"
      @pin="handlePin"
      @favorite="handleFavorite"
      @dedup="handleDedup"
      @close-domain="handleCloseDomain"
    />

    <DomainCardSection
      :groups="tabsStore.regularGroups"
      :favorited-urls="favStore.favoritedUrls"
      :dupe-map="dupeMap"
      :section-title="t('rightNow')"
      :show-close-all="true"
      @focus="tabsStore.focusTab($event)"
      @close="handleClose"
      @pin="handlePin"
      @favorite="handleFavorite"
      @dedup="handleDedup"
      @close-all="handleCloseAll"
      @close-domain="handleCloseDomain"
    />

    <EmptyState
      v-if="tabsStore.realTabs.length === 0"
      :message="t('favoritesEmpty')"
      :show="tabsStore.realTabs.length === 0 && !tabsStore.isLoading"
    />
  </div>
</template>
