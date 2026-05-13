<script setup lang="ts">
import { computed } from 'vue'
import type { DomainGroup, TabInfo } from '@/types'
import { useI18n } from '@/composables/useI18n'
import TabChip from './TabChip.vue'

const props = defineProps<{
  group: DomainGroup
  favoritedUrls: Set<string>
  dupeMap: Map<string, number>
  landingPages?: boolean
}>()
const emit = defineEmits<{
  focus: [tabId: number]
  close: [tabId: number]
  pin: [tabId: number]
  favorite: [tab: TabInfo]
  dedup: [url: string]
  closeAll: []
}>()
const { t } = useI18n()

const VISIBLE_CAP = 8
const dedupedTabs = computed(() => {
  const seen = new Set<string>()
  return props.group.tabs.filter(t => {
    if (seen.has(t.url)) return false
    seen.add(t.url)
    return true
  })
})
const visibleTabs = computed(() => dedupedTabs.value.slice(0, VISIBLE_CAP))
const extraCount = computed(() => Math.max(0, dedupedTabs.value.length - VISIBLE_CAP))
</script>

<template>
  <div class="mission-card domain-card has-neutral-bar">
    <div class="status-bar"></div>
    <div class="mission-content">
      <div class="mission-top">
        <span class="mission-name">{{ group.label || group.domain }}</span>
        <span class="open-tabs-badge">{{ group.tabs.length }}</span>
        <button
          class="action-btn close-tabs mission-close-all"
          :title="t('closeAllN', group.tabs.length)"
          @click="emit('closeAll')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div class="mission-pages">
        <TabChip
          v-for="tab in visibleTabs"
          :key="tab.id"
          :tab="tab"
          :is-favorited="favoritedUrls.has(tab.url)"
          :dupe-count="dupeMap.get(tab.url)"
          @focus="emit('focus', $event)"
          @close="emit('close', $event)"
          @pin="emit('pin', $event)"
          @favorite="emit('favorite', $event)"
          @dedup="emit('dedup', $event)"
        />
        <div v-if="extraCount > 0" class="page-chip page-chip-overflow clickable">
          <span class="chip-text">{{ t('plusN', extraCount) }}</span>
        </div>
      </div>
    </div>
    <div class="mission-meta">
      <div class="mission-page-count">{{ group.tabs.length }}</div>
      <div class="mission-page-label">{{ t('tabs') }}</div>
    </div>
  </div>
</template>
