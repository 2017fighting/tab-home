import { ref } from 'vue'
import { TOAST_DURATION } from '@/utils/constants'

const visible = ref(false)
const message = ref('')
let timer: ReturnType<typeof setTimeout> | null = null

export function useToast() {
  function show(msg: string) {
    message.value = msg
    visible.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { visible.value = false }, TOAST_DURATION)
  }

  function hide() {
    visible.value = false
  }

  return { visible, message, show, hide }
}
