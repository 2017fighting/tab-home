import { defineStore } from 'pinia'
import { useI18n } from '@/composables/useI18n'

const i18n = useI18n()

export const useI18nStore = defineStore('i18n', () => {
  return { ...i18n }
})
