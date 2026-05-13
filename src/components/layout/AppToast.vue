<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import IconCheckmark from '@/components/icons/IconCheckmark.vue'

const { visible, message } = useToast()
</script>

<template>
  <div class="toast" :class="{ visible: visible }">
    <IconCheckmark />
    <span>{{ message }}</span>
  </div>
</template>
