<script setup lang="ts">
import type { DomainGroup, TabInfo } from '@/types'
import { useI18n } from '@/composables/useI18n'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import DomainCard from './DomainCard.vue'

const props = defineProps<{
  groups: DomainGroup[]
  favoritedUrls: Set<string>
  dupeMap: Map<string, number>
  sectionTitle: string
  showCloseAll?: boolean
}>()
const emit = defineEmits<{
  focus: [tabId: number]
  close: [tabId: number]
  pin: [tabId: number]
  favorite: [tab: TabInfo]
  dedup: [url: string]
  closeAll: []
  closeDomain: [domain: string]
}>()
const { t } = useI18n()

function totalTabs(): number {
  return props.groups.reduce((sum, g) => sum + g.tabs.length, 0)
}
</script>

<template>
  <div class="active-subsection" v-if="groups.length > 0">
    <SectionHeader :title="sectionTitle" :count="String(totalTabs())">
      <template v-if="showCloseAll" #action>
        <button class="close-all-section-btn" @click="emit('closeAll')">
          {{ t('closeAllN', totalTabs()) }}
        </button>
      </template>
    </SectionHeader>
    <div class="missions">
      <DomainCard
        v-for="group in groups"
        :key="group.domain"
        :group="group"
        :favorited-urls="favoritedUrls"
        :dupe-map="dupeMap"
        @focus="emit('focus', $event)"
        @close="emit('close', $event)"
        @pin="emit('pin', $event)"
        @favorite="emit('favorite', $event)"
        @dedup="emit('dedup', $event)"
        @close-all="emit('closeDomain', group.domain)"
      />
    </div>
  </div>
</template>
