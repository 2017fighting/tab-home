<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'

const props = defineProps<{ count: number }>()
const emit = defineEmits<{ dedup: [] }>()
const { t } = useI18n()
</script>

<template>
  <span class="dupe-badge" :title="t('dupeBadge', count)" @click.stop="emit('dedup')">
    {{ count }}x
  </span>
</template>
