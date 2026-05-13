<script setup lang="ts">
import { useConfirm } from '@/composables/useConfirm'

const { visible, confirmMessage, okLabel, cancelLabel, confirm, cancel } = useConfirm()
</script>

<template>
  <div v-if="visible" class="confirm-modal" @click.self="cancel()">
    <div class="confirm-card">
      <div class="confirm-message">{{ confirmMessage }}</div>
      <div class="confirm-actions">
        <button class="confirm-cancel" @click="cancel()">{{ cancelLabel }}</button>
        <button class="confirm-ok" @click="confirm()">{{ okLabel }}</button>
      </div>
    </div>
  </div>
</template>
