<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'
import { useTabsStore } from '@/stores/useTabsStore'

const { t } = useI18n()
const tabsStore = useTabsStore()
</script>

<template>
  <footer>
    <div class="footer-stats">
      <div class="stat">
        <div class="stat-num">{{ tabsStore.realTabs.length }}</div>
        <div class="stat-label">{{ t('statTabs') }}</div>
      </div>
    </div>
    <div class="last-refresh">
      <span style="color: var(--muted); font-size: 11px;">
        tab-home by <a href="https://x.com/wolfyxbt" target="_top" style="color: var(--muted); text-decoration: underline; text-underline-offset: 2px;">WolfyXBT</a>
        &middot; forked from <a href="https://github.com/zarazhangrui/tab-out" target="_top" style="color: var(--muted); text-decoration: underline; text-underline-offset: 2px;">tab-out</a>
        by <a href="https://x.com/zarazhangrui" target="_top" style="color: var(--muted); text-decoration: underline; text-underline-offset: 2px;">Zara</a>
      </span>
    </div>
  </footer>
</template>
