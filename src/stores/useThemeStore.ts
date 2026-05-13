import { defineStore } from 'pinia'
import { useTheme } from '@/composables/useTheme'

const theme = useTheme()

export const useThemeStore = defineStore('theme', () => {
  return { ...theme }
})
