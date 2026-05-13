<script setup lang="ts">
defineProps<{ title: string; count?: string }>()
</script>

<template>
  <div class="section-header">
    <h2>{{ title }}</h2>
    <div class="section-line"></div>
    <div v-if="count" class="section-count">{{ count }}</div>
    <div class="section-action">
      <slot name="action" />
    </div>
  </div>
</template>
