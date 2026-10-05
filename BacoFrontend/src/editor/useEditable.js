import { ref } from 'vue'
import { useEditorStore } from './store'

export function useEditable(sectionId, propKey) {
  const store = useEditorStore()
  const isEditing = ref(false)

  const onInput = (event) => {
    if (!isEditing.value) return
    // For contenteditable, we get the text content or innerHTML
    const value = event.target.innerText 
    store.updateProp(sectionId, propKey, value)
  }

  const toggleEdit = () => {
    isEditing.value = !isEditing.value
  }

  return {
    isEditing,
    onInput,
    toggleEdit
  }
}