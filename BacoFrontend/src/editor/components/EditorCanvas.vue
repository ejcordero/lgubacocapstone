<script setup>
import { computed } from 'vue'
import { useEditorStore } from '../store'
import { sectionRegistry } from '../registry'

const store = useEditorStore()

const canvasWidth = computed(() => {
  if (store.device === 'mobile') return '390px'
  if (store.device === 'tablet') return '768px'
  return '100%'
})

const canvasTransform = computed(() => `scale(${store.zoom / 100})`)

// Check if current page has full-page blocks
const hasFullPageBlocks = computed(() => {
  return store.sections.some(s => sectionRegistry[s.type]?.category === 'page')
})
</script>

<template>
  <main class="editor-canvas" @click.self="store.select(null)">
    <div class="canvas-inner">
      <div class="dot-grid"></div>
      
      <div 
        class="page-frame"
        :class="{ 'full-page-mode': hasFullPageBlocks }"
        :style="{ 
          width: canvasWidth,
          transform: canvasTransform
        }"
      >
        <div v-if="store.sections.length === 0" class="empty-canvas">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <h3>Start building your page</h3>
          <p>Click on a block from the left panel to add it to the canvas</p>
        </div>

        <div v-else class="sections-container">
          <div
            v-for="section in store.sections"
            :key="section.id"
            class="section-wrapper"
            :class="{
              selected: store.selectedId === section.id,
              hidden: !section.visible,
              'full-page': sectionRegistry[section.type]?.category === 'page'
            }"
            @click.stop="store.select(section.id)"
          >
            <div v-if="store.selectedId === section.id" class="section-toolbar">
              <div class="toolbar-label">
                <i class="fa-solid" :class="sectionRegistry[section.type]?.icon"></i>
                {{ sectionRegistry[section.type]?.label }}
              </div>
              <div class="toolbar-actions">
                <button @click.stop="store.toggleVisibility(section.id)" :title="section.visible ? 'Hide' : 'Show'">
                  <i class="fa-solid" :class="section.visible ? 'fa-eye' : 'fa-eye-slash'"></i>
                </button>
              </div>
            </div>

            <div v-if="section.visible" class="section-content">
              <component
                :is="sectionRegistry[section.type]?.component"
                v-bind="section.props"
                :isEditing="true"
              />
            </div>
            
            <div v-else class="section-hidden-placeholder">
              <i class="fa-solid fa-eye-slash"></i>
              <span>{{ sectionRegistry[section.type]?.label }} (Hidden)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.editor-canvas {
  flex: 1;
  background: #eef0f4;
  overflow: auto;
  position: relative;
}

.canvas-inner {
  min-height: 100%;
  display: flex;
  justify-content: center;
  padding: 40px 32px;
  position: relative;
}

.dot-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, #d1d5db 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.5;
  pointer-events: none;
}

.page-frame {
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 8px 32px rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  position: relative;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top center;
  overflow: hidden;
  min-height: 600px;
}

.page-frame.full-page-mode {
  border-radius: 0;
  box-shadow: none;
}

.empty-canvas {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
}

.empty-canvas i {
  font-size: 48px;
  color: #0B198F;
  margin-bottom: 16px;
  opacity: 0.3;
}

.empty-canvas h3 {
  font-size: 20px;
  font-weight: 700;
  color: #0B198F;
  margin: 0 0 8px;
}

.empty-canvas p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.sections-container {
  display: flex;
  flex-direction: column;
}

.section-wrapper {
  position: relative;
  border: 2px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}

.section-wrapper:hover {
  border-color: rgba(11, 25, 143, 0.3);
}

.section-wrapper.selected {
  border-color: #0B198F;
  z-index: 10;
}

.section-wrapper.hidden {
  opacity: 0.4;
}

.section-wrapper.full-page {
  border: none;
}

.section-wrapper.full-page.selected {
  border: 2px solid #0B198F;
}

.section-toolbar {
  position: absolute;
  top: -36px;
  left: 50%;
  transform: translateX(-50%);
  background: #0B198F;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  font-weight: 600;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

.toolbar-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-actions {
  display: flex;
  gap: 4px;
}

.toolbar-actions button {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-actions button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.section-content {
  pointer-events: none;
}

.section-wrapper:hover .section-content {
  pointer-events: auto;
}

.section-hidden-placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  font-style: italic;
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  margin: 10px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.section-hidden-placeholder i {
  color: #94a3b8;
}
</style>