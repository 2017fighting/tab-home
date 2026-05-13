<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Favorite, FavoriteFormData } from '@/types'
import { useI18n } from '@/composables/useI18n'
import { normalizeUrl } from '@/utils/url'
import { MAX_ICON_DIMENSION } from '@/utils/constants'

const props = defineProps<{ editingFavorite: Favorite | null; visible: boolean }>()
const emit = defineEmits<{
  save: [form: FavoriteFormData]
  delete: [id: string]
  close: []
}>()

const { t } = useI18n()

const url = ref('')
const title = ref('')
const logoDataUrl = ref<string | null>(null)
const logoPreview = ref<string>('')
const clearLogo = ref(false)

watch(() => props.editingFavorite, (fav) => {
  if (fav) {
    url.value = fav.url
    title.value = fav.title
    logoDataUrl.value = fav.customLogo || null
    logoPreview.value = fav.customLogo || ''
    clearLogo.value = false
  }
}, { immediate: true })

watch(() => props.visible, (v) => {
  if (!v) {
    url.value = ''
    title.value = ''
    logoDataUrl.value = null
    logoPreview.value = ''
    clearLogo.value = false
  }
})

function handleLogoUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    compressImage(reader.result as string)
  }
  reader.readAsDataURL(file)
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile()
      if (!blob) continue
      const reader = new FileReader()
      reader.onload = () => compressImage(reader.result as string)
      reader.readAsDataURL(blob)
      break
    }
  }
}

function compressImage(dataUrl: string) {
  const img = new Image()
  img.onload = () => {
    let w = img.width, h = img.height
    if (w > MAX_ICON_DIMENSION || h > MAX_ICON_DIMENSION) {
      const ratio = Math.min(MAX_ICON_DIMENSION / w, MAX_ICON_DIMENSION / h)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0, w, h)
      logoDataUrl.value = canvas.toDataURL('image/png')
      logoPreview.value = logoDataUrl.value
    }
  }
  img.src = dataUrl
}

function resetLogo() {
  logoDataUrl.value = null
  logoPreview.value = ''
  clearLogo.value = true
}

function onSubmit(e: Event) {
  e.preventDefault()
  const normalizedUrl = normalizeUrl(url.value.trim())
  if (!normalizedUrl) return
  const form: FavoriteFormData = {
    url: normalizedUrl,
    title: title.value.trim() || normalizedUrl,
    customLogo: clearLogo.value ? null : (logoDataUrl.value || undefined),
  }
  emit('save', form)
}

function handleDelete() {
  if (props.editingFavorite) {
    emit('delete', props.editingFavorite.id)
  }
}
</script>

<template>
  <div v-if="visible" class="favorites-modal" @click.self="emit('close')" @paste="handlePaste">
    <form class="favorites-form favorites-form-modal" @submit="onSubmit">
      <label class="favorites-form-label">{{ t('urlLabel') }}</label>
      <input v-model="url" type="text" class="favorites-form-input" placeholder="https://..." required autocomplete="off" spellcheck="false" />

      <label class="favorites-form-label">{{ t('titleLabel') }}</label>
      <input v-model="title" type="text" class="favorites-form-input" :placeholder="t('titlePlaceholder')" autocomplete="off" />

      <div class="favorites-form-logo">
        <div class="favorites-logo-preview">
          <span v-if="!logoPreview" class="favorites-logo-placeholder">{{ t('auto') }}</span>
          <img v-else id="favoritesLogoPreviewImg" :src="logoPreview" alt="" />
        </div>
        <label for="favoritesLogoInput" class="favorites-logo-upload">{{ t('uploadLogo') }}</label>
        <input id="favoritesLogoInput" type="file" accept="image/*" hidden @change="handleLogoUpload" />
        <button type="button" class="favorites-logo-reset" @click="resetLogo">{{ t('reset') }}</button>
      </div>

      <div class="favorites-form-actions">
        <button v-if="editingFavorite" type="button" class="favorites-form-delete" @click="handleDelete">{{ t('remove') }}</button>
        <div class="favorites-form-actions-right">
          <button type="button" class="favorites-form-cancel" @click="emit('close')">{{ t('cancel') }}</button>
          <button type="submit" class="favorites-form-submit">{{ editingFavorite ? t('save') : t('add') }}</button>
        </div>
      </div>
    </form>
  </div>
</template>
