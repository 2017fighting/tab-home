<script setup lang="ts">
import { computed } from 'vue'
import type { Favorite } from '@/types'

const props = defineProps<{ favorite: Favorite; isDragging?: boolean }>()
const emit = defineEmits<{
  click: [fav: Favorite]
  dragstart: [e: DragEvent, id: string]
  dragend: [e: DragEvent]
  dragover: [e: DragEvent]
  drop: [e: DragEvent, id: string]
}>()

const displayIcon = computed(() => {
  if (props.favorite.customLogo) return props.favorite.customLogo
  if (props.favorite.iconUrl) return props.favorite.iconUrl
  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(props.favorite.url)}&size=32`
})
</script>

<template>
  <div
    class="favorite-item"
    :class="{ dragging: isDragging }"
    draggable="true"
    @click="emit('click', favorite)"
    @dragstart="emit('dragstart', $event, favorite.id)"
    @dragend="emit('dragend', $event)"
    @dragover="emit('dragover', $event)"
    @drop="emit('drop', $event, favorite.id)"
  >
    <div class="favorite-icon">
      <img :src="displayIcon" :alt="favorite.title" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
    </div>
    <span class="favorite-title">{{ favorite.title }}</span>
  </div>
</template>
