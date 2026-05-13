<script setup lang="ts">
import { useDateDisplay } from '@/composables/useDateDisplay'
import { useTheme } from '@/composables/useTheme'
import { useI18n } from '@/composables/useI18n'
import { useTabsStore } from '@/stores/useTabsStore'
import IconSun from '@/components/icons/IconSun.vue'
import IconMoon from '@/components/icons/IconMoon.vue'

const { dateString } = useDateDisplay()
const { mode: themeMode, toggle: toggleTheme } = useTheme()
const { lang, t, toggleLang } = useI18n()
const tabsStore = useTabsStore()
</script>

<template>
  <header>
    <div class="header-left">
      <div class="date">{{ dateString }}</div>
    </div>
    <div class="header-right">
      <div v-if="tabsStore.tabHomeCount > 1" class="tab-cleanup-banner">
        <div class="tab-cleanup-left">
          <div class="tab-cleanup-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
            </svg>
          </div>
          <div class="tab-cleanup-text">
            <strong>{{ tabsStore.tabHomeCount }}</strong> {{ t('nWolfyTabsOpen') }}
          </div>
        </div>
        <button class="tab-cleanup-btn" @click="tabsStore.closeTabHomeDupes()">{{ t('keepOne') }}</button>
      </div>
      <button class="theme-toggle" @click="toggleTheme()" :title="themeMode === 'dark' ? 'Light mode' : 'Dark mode'">
        <IconSun v-if="themeMode === 'dark'" />
        <IconMoon v-else />
      </button>
      <button class="lang-toggle" @click="toggleLang()">{{ t('langToggle') }}</button>
    </div>
  </header>
</template>
