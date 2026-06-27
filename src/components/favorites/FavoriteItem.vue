<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Favorite } from '@/types'

const props = defineProps<{ favorite: Favorite; isDragging?: boolean }>()
const emit = defineEmits<{
  edit: [fav: Favorite]
  remove: [fav: Favorite]
  dragstart: [e: DragEvent, id: string]
  dragend: [e: DragEvent]
  dragover: [e: DragEvent]
  drop: [e: DragEvent, id: string]
}>()

const menuOpen = ref(false)
const menuBtn = ref<InstanceType<typeof HTMLButtonElement>>()
const popupMenu = ref<HTMLDivElement>()

function closeMenu() {
  menuOpen.value = false
  document.removeEventListener('mousedown', onDocMouseDown)
}
function onDocMouseDown(e: MouseEvent) {
  // Ignore presses on the toggle button or inside the popup itself — those are
  // handled by their own click handlers. `mousedown` fires before `click`, so
  // without this guard the popup unmounts before the item's click can run.
  const target = e.target as Node | null
  if (!target) return
  if (menuBtn.value?.contains(target) || popupMenu.value?.contains(target)) return
  closeMenu()
}
function openMenu() {
  menuOpen.value = true
  setTimeout(() => document.addEventListener('mousedown', onDocMouseDown), 0)
}
function toggleMenu(e: MouseEvent) {
  e.stopPropagation()
  menuOpen.value ? closeMenu() : openMenu()
}

function openUrl(e: MouseEvent) {
  e.preventDefault()
  const { url } = props.favorite
  const meta = e.metaKey || e.ctrlKey
  const shift = e.shiftKey

  if (meta && shift) {
    chrome.tabs.create({ url, active: true })
  } else if (meta) {
    chrome.tabs.create({ url, active: false })
  } else if (shift) {
    chrome.windows.create({ url })
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) chrome.tabs.update(tab.id, { url })
    })
  }
}

function handleAuxClick(e: MouseEvent) {
  if (e.button === 1) {
    e.preventDefault()
    chrome.tabs.create({ url: props.favorite.url, active: false })
  }
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  openMenu()
}

function handleEdit(e: MouseEvent) {
  e.stopPropagation()
  closeMenu()
  emit('edit', props.favorite)
}

function handleRemove(e: MouseEvent) {
  e.stopPropagation()
  closeMenu()
  emit('remove', props.favorite)
}

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
    @click="openUrl"
    @auxclick="handleAuxClick"
    @contextmenu="handleContextMenu"
    @dragstart="emit('dragstart', $event, favorite.id)"
    @dragend="emit('dragend', $event)"
    @dragover="emit('dragover', $event)"
    @drop="emit('drop', $event, favorite.id)"
  >
    <div class="favorite-icon">
      <img :src="displayIcon" :alt="favorite.title" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
    </div>
    <span class="favorite-title">{{ favorite.title }}</span>
    <button ref="menuBtn" class="favorite-menu" @click.stop="toggleMenu" title="More">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
    </button>
    <div v-if="menuOpen" ref="popupMenu" class="favorite-popup-menu" @click.stop>
      <button class="favorite-popup-item" @click="handleEdit">Edit</button>
      <button class="favorite-popup-item favorite-popup-item-danger" @click="handleRemove">Remove</button>
    </div>
  </div>
</template>
