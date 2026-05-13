<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Favorite, FavoriteFormData } from '@/types'
import { useFavoritesStore } from '@/stores/useFavoritesStore'
import { useI18n } from '@/composables/useI18n'
import { useConfirm } from '@/composables/useConfirm'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { useToast } from '@/composables/useToast'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FavoriteItem from './FavoriteItem.vue'
import FavoriteEmptySlot from './FavoriteEmptySlot.vue'
import FavoriteFormModal from './FavoriteFormModal.vue'

const store = useFavoritesStore()
const { t } = useI18n()
const { show: showConfirm } = useConfirm()
const { show: showToast } = useToast()
const { draggedFavId, onDragStart, onDragOver, onDragEnd } = useDragAndDrop()

const formVisible = ref(false)
const editingFav = ref<Favorite | null>(null)

watch(() => store.items.length, (n) => {
  console.log('[FavoritesColumn] items.length changed to:', n)
  console.log('[FavoritesColumn] bySlotOrdered:', store.bySlotOrdered)
  console.log('[FavoritesColumn] totalSlots:', store.totalSlots)
})

function openAdd() {
  editingFav.value = null
  formVisible.value = true
}

function openEdit(fav: Favorite) {
  editingFav.value = fav
  formVisible.value = true
}

async function handleSave(form: FavoriteFormData) {
  if (editingFav.value) {
    await store.update(editingFav.value.id, form)
    showToast(t('favoriteUpdated'))
  } else {
    const ok = await store.add(form)
    if (!ok) {
      showToast(t('alreadyAdded'))
      return
    }
    showToast(t('addedToFavorites'))
  }
  formVisible.value = false
  editingFav.value = null
}

async function handleRemove(fav: Favorite) {
  const ok = await showConfirm({ message: t('confirmRemoveFav') })
  if (!ok) return
  await store.remove(fav.id)
  showToast(t('removedFromFavorites'))
}

async function handleDropOnSlot(e: DragEvent, targetSlot: number) {
  e.preventDefault()
  if (!draggedFavId.value) return
  await store.moveSlot(draggedFavId.value, targetSlot)
}

async function handleDropOnItem(e: DragEvent, targetId: string) {
  e.preventDefault()
  if (!draggedFavId.value || draggedFavId.value === targetId) return
  await store.swapSlots(draggedFavId.value, targetId)
}

const slotIndices = computed(() => {
  const count = store.totalSlots
  return Array.from({ length: count }, (_, i) => i)
})

function favAtSlot(slot: number): Favorite | undefined {
  return store.bySlotOrdered.find(f => f.slot === slot)
}
</script>

<template>
  <div class="favorites-column" id="favoritesColumn">
    <SectionHeader :title="t('favorites')">
      <template #action>
        <button class="favorites-add-btn" @click="openAdd" :title="t('addAFavorite')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        </button>
      </template>
    </SectionHeader>

    <div class="favorites-list" id="favoritesList">
      <template v-for="slot in slotIndices" :key="slot">
        <FavoriteItem
          v-if="favAtSlot(slot)"
          :favorite="favAtSlot(slot)!"
          :is-dragging="draggedFavId === favAtSlot(slot)!.id"
          @edit="openEdit"
          @remove="handleRemove"
          @dragstart="(e, id) => onDragStart(e, id)"
          @dragend="onDragEnd"
          @dragover="onDragOver"
          @drop="(e, id) => handleDropOnItem(e, id)"
        />
        <FavoriteEmptySlot
          v-else
          :slot-index="slot"
          @dragover="onDragOver"
          @drop="(e, s) => handleDropOnSlot(e, s)"
        />
      </template>
    </div>

    <EmptyState v-if="store.items.length === 0" :message="t('favoritesEmpty')" :show="store.items.length === 0" />

    <FavoriteFormModal
      :visible="formVisible"
      :editing-favorite="editingFav"
      @save="handleSave"
      @delete="(id) => { handleRemove(editingFav!); }"
      @close="formVisible = false"
    />
  </div>
</template>
