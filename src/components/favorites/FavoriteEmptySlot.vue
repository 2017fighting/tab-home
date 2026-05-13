<script setup lang="ts">
const props = defineProps<{ slotIndex: number }>()
const emit = defineEmits<{
  dragover: [e: DragEvent]
  drop: [e: DragEvent, slot: number]
}>()
</script>

<template>
  <div
    class="favorite-empty-slot"
    @dragover="emit('dragover', $event)"
    @drop="emit('drop', $event, slotIndex)"
  />
</template>
