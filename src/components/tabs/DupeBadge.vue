<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'

const props = defineProps<{ count: number }>()
const emit = defineEmits<{ dedup: [] }>()
const { t } = useI18n()
</script>

<template>
  <button
    class="chip-dupe-badge"
    :title="t('closeDupes')"
    @click.stop="emit('dedup')"
  >
    <span class="dupe-count">{{ t('dupeBadge', count) }}</span>
    <span class="dupe-action">{{ t('closeDupes') }}</span>
  </button>
</template>
