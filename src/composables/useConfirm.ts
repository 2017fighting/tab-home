import { ref } from 'vue'

const visible = ref(false)
const confirmMessage = ref('')
const okLabel = ref('Confirm')
const cancelLabel = ref('Cancel')
let resolvePromise: ((value: boolean) => void) | null = null

export function useConfirm() {
  function show(opts: { message: string; okLabel?: string; cancelLabel?: string }): Promise<boolean> {
    confirmMessage.value = opts.message
    okLabel.value = opts.okLabel || 'Confirm'
    cancelLabel.value = opts.cancelLabel || 'Cancel'
    visible.value = true
    return new Promise((resolve) => { resolvePromise = resolve })
  }

  function confirm() {
    visible.value = false
    resolvePromise?.(true)
    resolvePromise = null
  }

  function cancel() {
    visible.value = false
    resolvePromise?.(false)
    resolvePromise = null
  }

  return { visible, confirmMessage, okLabel, cancelLabel, show, confirm, cancel }
}
