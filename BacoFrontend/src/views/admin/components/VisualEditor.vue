<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '@/editor/store'
import EditorCommandBar from '@/editor/components/EditorCommandBar.vue'
import EditorLeftPanel from '@/editor/components/EditorLeftPanel.vue'
import EditorCanvas from '@/editor/components/EditorCanvas.vue'
import EditorInspector from '@/editor/components/EditorInspector.vue'

const store = useEditorStore()
const emit = defineEmits(['exit'])

onMounted(() => {
  store.load('home')
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.body.style.overflow = ''
})

const handleExit = () => {
  if (store.isDirty && !confirm('You have unsaved changes. Are you sure you want to exit?')) {
    return
  }
  emit('exit')
}
</script>

<template>
  <div class="visual-editor-fullscreen">
    <EditorCommandBar @exit="handleExit" />
    <div class="editor-workspace">
      <EditorLeftPanel />
      <EditorCanvas />
      <EditorInspector />
    </div>
  </div>
</template>

<style scoped>
.visual-editor-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
}

.editor-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}
</style>