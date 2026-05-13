<script setup lang="ts">
defineProps<{ message: string; show?: boolean }>()
</script>

<template>
  <div v-if="show !== false" class="favorites-empty">
    {{ message }}
  </div>
</template>
