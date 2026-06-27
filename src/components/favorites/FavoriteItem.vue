<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
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
  window.removeEventListener('scroll', closeMenuOnScroll, true)
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
// Close the popup on any scroll (capture phase so nested scrollers — the
// favorites column — trigger it too). Otherwise the fixed popup detaches from
// the button as the list scrolls under it.
function closeMenuOnScroll() {
  closeMenu()
}
// Anchor the popup to the 3-dot button (right-aligned, dropping just below it)
// and clamp it inside the viewport. Runs after the popup renders so its
// measured size is known.
function positionMenu() {
  const btn = menuBtn.value
  const menu = popupMenu.value
  if (!btn || !menu) return
  const btnRect = btn.getBoundingClientRect()
  const menuRect = menu.getBoundingClientRect()
  const margin = 4
  const pad = 8
  let top = btnRect.bottom + margin
  let left = btnRect.right - menuRect.width
  // Flip above the button when it would overflow the bottom edge.
  if (top + menuRect.height > window.innerHeight - pad) {
    top = btnRect.top - menuRect.height - margin
  }
  // Clamp into the viewport.
  left = Math.min(left, window.innerWidth - menuRect.width - pad)
  left = Math.max(left, pad)
  top = Math.max(top, pad)
  menu.style.top = `${Math.round(top)}px`
  menu.style.left = `${Math.round(left)}px`
}
function openMenu() {
  menuOpen.value = true
  void nextTick(positionMenu)
  setTimeout(() => {
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('scroll', closeMenuOnScroll, true)
  }, 0)
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
      <button class="favorite-popup-item" @click="handleEdit">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
        <span>Edit</span>
      </button>
      <div class="favorite-popup-separator" aria-hidden="true"></div>
      <button class="favorite-popup-item favorite-popup-item-danger" @click="handleRemove">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
        <span>Remove</span>
      </button>
    </div>
  </div>
</template>
