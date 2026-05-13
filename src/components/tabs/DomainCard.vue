<script setup lang="ts">
import { computed } from 'vue'
import type { DomainGroup, TabInfo } from '@/types'
import { useI18n } from '@/composables/useI18n'
import TabChip from './TabChip.vue'

const props = defineProps<{
  group: DomainGroup
  favoritedUrls: Set<string>
  dupeMap: Map<string, number>
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
const visibleTabs = computed(() => props.group.tabs.slice(0, VISIBLE_CAP))
const extraCount = computed(() => Math.max(0, props.group.tabs.length - VISIBLE_CAP))
</script>

<template>
  <div class="domain-card">
    <div class="domain-card-header">
      <div class="domain-info">
        <span class="domain-name">{{ group.label || group.domain }}</span>
        <span class="domain-count">{{ group.tabs.length }}</span>
      </div>
      <button class="close-all-btn" @click="emit('closeAll')" :title="t('closeAllN', group.tabs.length)">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>
    <div class="domain-tabs">
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
      <span v-if="extraCount > 0" class="overflow-chip">{{ t('plusN', extraCount) }}</span>
    </div>
  </div>
</template>
