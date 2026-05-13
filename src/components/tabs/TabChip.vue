<script setup lang="ts">
import { computed } from 'vue'
import type { TabInfo } from '@/types'
import { useI18n } from '@/composables/useI18n'
import DupeBadge from './DupeBadge.vue'

const props = defineProps<{ tab: TabInfo; isFavorited: boolean; dupeCount?: number }>()
const emit = defineEmits<{
  focus: [tabId: number]
  close: [tabId: number]
  pin: [tabId: number]
  favorite: [tab: TabInfo]
  dedup: [url: string]
}>()
const { t } = useI18n()

const faviconSrc = computed(() =>
  `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(props.tab.url)}&size=16`
)

const chipClass = computed(() => {
  let c = ''
  if (props.tab.active) c += ' active'
  return c
})

const safeTitle = computed(() => {
  return props.tab.title.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
})
</script>

<template>
  <div class="page-chip clickable" :class="chipClass" :title="safeTitle" @click="emit('focus', tab.id)">
    <img
      v-if="tab.url"
      class="chip-favicon"
      :src="faviconSrc"
      alt=""
      @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
    />
    <span class="chip-text">{{ tab.title }}</span>
    <DupeBadge v-if="dupeCount && dupeCount > 1" :count="dupeCount" @dedup="emit('dedup', tab.url)" />
    <div class="chip-actions">
      <button
        class="chip-action chip-star"
        :class="{ active: isFavorited }"
        :title="isFavorited ? t('removeFromFav') : t('addToFav')"
        @click.stop="emit('favorite', tab)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
      </button>
      <button
        class="chip-action chip-pin"
        :class="{ active: tab.pinned }"
        :title="tab.pinned ? t('unpinTip') : t('pinTip')"
        @click.stop="emit('pin', tab.id)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-1.5 1.5-5.25-5.25-3.75 3.75 1.5 1.5L3 19.5l4.5-4.5 1.5 1.5 3.75-3.75 5.25 5.25 1.5-1.5-7.5-7.5Z" /></svg>
      </button>
      <button
        class="chip-action chip-close"
        :title="t('closeThisTab')"
        @click.stop="emit('close', tab.id)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>
  </div>
</template>
