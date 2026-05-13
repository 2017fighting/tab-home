import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from './useI18n'
import { getDateDisplay } from '@/utils/time'

export function useDateDisplay() {
  const { lang } = useI18n()
  const dateString = ref(getDateDisplay(lang.value === 'zh' ? 'zh-CN' : 'en-US'))

  let timer: ReturnType<typeof setInterval> | null = null

  function update() {
    dateString.value = getDateDisplay(lang.value === 'zh' ? 'zh-CN' : 'en-US')
  }

  watch(lang, update)

  update()
  timer = setInterval(update, 60_000)

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return { dateString }
}
