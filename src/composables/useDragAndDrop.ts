import { ref } from 'vue'

const draggedFavId = ref<string | null>(null)

export function useDragAndDrop() {
  function onDragStart(e: DragEvent, favId: string) {
    draggedFavId.value = favId
    e.dataTransfer?.setData('text/plain', favId)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    if (e.target instanceof HTMLElement) {
      e.target.classList.add('dragging')
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  }

  function onDragEnd(e: DragEvent) {
    draggedFavId.value = null
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('dragging')
    }
  }

  return { draggedFavId, onDragStart, onDragOver, onDragEnd }
}
