<script setup lang="ts">
import { computed } from 'vue'
import type { TabInfo } from '@/types'
import { useI18n } from '@/composables/useI18n'
import IconStar from '@/components/icons/IconStar.vue'
import IconPin from '@/components/icons/IconPin.vue'
import IconClose from '@/components/icons/IconClose.vue'
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
</script>

<template>
  <div class="tab-chip" @click="emit('focus', tab.id)">
    <img
      class="tab-chip-favicon"
      :src="faviconSrc"
      alt=""
      @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
    />
    <span class="tab-chip-title">{{ tab.title }}</span>
    <DupeBadge v-if="dupeCount && dupeCount > 1" :count="dupeCount" @dedup="emit('dedup', tab.url)" />
    <div class="tab-chip-actions">
      <button class="tab-action-btn star-btn" :class="{ active: isFavorited }" :title="isFavorited ? t('removeFromFav') : t('addToFav')" @click.stop="emit('favorite', tab)">
        <IconStar />
      </button>
      <button class="tab-action-btn pin-btn" :title="tab.pinned ? t('unpinTip') : t('pinTip')" @click.stop="emit('pin', tab.id)">
        <IconPin />
      </button>
      <button class="tab-action-btn close-btn" :title="t('closeThisTab')" @click.stop="emit('close', tab.id)">
        <IconClose />
      </button>
    </div>
  </div>
</template>
