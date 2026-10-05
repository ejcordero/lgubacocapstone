<script setup>
import { computed } from 'vue'
import { useEditorStore } from '../store'
import { EDITABLE_PAGES } from '../meta'

const store = useEditorStore()
const emit = defineEmits(['exit'])

const pageTitle = computed({
  get: () => store.currentPage?.name || '',
  set: (val) => store.renamePage(val)
})

const statusText = computed(() => {
  if (store.isSaving) return 'Saving...'
  if (store.lastPublished) return 'Published'
  if (store.lastSaved) return 'Saved'
  return store.isDirty ? 'Unsaved' : 'Draft'
})

const statusClass = computed(() => {
  if (store.isSaving) return 'saving'
  if (store.lastPublished) return 'published'
  if (store.lastSaved) return 'saved'
  return store.isDirty ? 'draft' : 'draft'
})

const devices = [
  { id: 'desktop', icon: 'fa-display', label: 'Desktop' },
  { id: 'tablet', icon: 'fa-tablet-screen-button', label: 'Tablet' },
  { id: 'mobile', icon: 'fa-mobile-screen-button', label: 'Mobile' }
]

const exitEditor = () => {
  emit('exit')
}

const switchPage = (slug) => {
  store.switchPage(slug)
}
</script>

<template>
  <header class="command-bar">
    <div class="cb-left">
      <button class="exit-btn" @click="exitEditor" title="Exit to Dashboard">
        <i class="fa-solid fa-arrow-left"></i>
        <span>Exit</span>
      </button>
      <div class="cb-separator"></div>
      
      <div class="brand">
        <div class="brand-icon">
          <i class="fa-solid fa-landmark"></i>
        </div>
        <div class="brand-text">
          <span class="brand-name">Baco Visual Editor</span>
          <span class="brand-subtitle">baco.gov.ph</span>
        </div>
      </div>
      
      <div class="cb-separator"></div>
      
      <!-- PAGE SELECTOR DROPDOWN -->
      <select 
        class="page-selector" 
        :value="store.currentSlug"
        @change="switchPage($event.target.value)"
      >
        <option 
          v-for="page in EDITABLE_PAGES" 
          :key="page.slug" 
          :value="page.slug"
        >
          {{ page.label }}
        </option>
      </select>
      
      <input 
        type="text" 
        class="page-title-input"
        v-model="pageTitle"
        placeholder="Page Name"
        spellcheck="false"
      />
      
      <span class="status-chip" :class="statusClass">
        {{ statusText }}
      </span>
    </div>

    <div class="cb-center">
      <div class="cb-group">
        <button 
          class="cb-btn" 
          @click="store.undo()"
          :disabled="!store.canUndo"
          title="Undo (Ctrl+Z)"
        >
          <i class="fa-solid fa-rotate-left"></i>
        </button>
        <button 
          class="cb-btn" 
          @click="store.redo()"
          :disabled="!store.canRedo"
          title="Redo (Ctrl+Shift+Z)"
        >
          <i class="fa-solid fa-rotate-right"></i>
        </button>
      </div>
      
      <div class="cb-separator"></div>
      
      <div class="cb-group device-group">
        <button 
          v-for="dev in devices" 
          :key="dev.id"
          class="cb-btn"
          :class="{ active: store.device === dev.id }"
          @click="store.device = dev.id"
          :title="dev.label"
        >
          <i class="fa-solid" :class="dev.icon"></i>
        </button>
      </div>
    </div>

    <div class="cb-right">
      <div class="zoom-control">
        <button class="zoom-btn" @click="store.setZoom(store.zoom - 10)">
          <i class="fa-solid fa-minus"></i>
        </button>
        <span class="zoom-value" @click="store.setZoom(100)">{{ store.zoom }}%</span>
        <button class="zoom-btn" @click="store.setZoom(store.zoom + 10)">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
      
      <div class="cb-separator"></div>
      
      <button 
        class="cb-btn save-btn"
        @click="store.saveDraft()"
        :disabled="store.isSaving || !store.isDirty"
        title="Save Draft"
      >
        <i class="fa-solid fa-floppy-disk"></i>
      </button>
      
      <button 
        class="publish-btn"
        @click="store.publish()"
        :disabled="store.isSaving"
      >
        <i class="fa-solid fa-rocket"></i>
        <span>Publish</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.command-bar {
  height: 56px;
  background: linear-gradient(to bottom, #0a1f3d 0%, #0B198F 100%);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.command-bar::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #CE1126 0%, #FFD700 50%, #CE1126 100%);
}

.cb-left,
.cb-center,
.cb-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cb-left {
  flex: 1;
}

.cb-center {
  gap: 8px;
}

.cb-right {
  gap: 12px;
}

.exit-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.exit-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.cb-separator {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #CE1126 0%, #8B0000 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: white;
  box-shadow: 0 2px 8px rgba(206, 17, 38, 0.4);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-name {
  color: white;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.3px;
}

.brand-subtitle {
  color: #FFD700;
  font-size: 11px;
  font-weight: 500;
}

.page-selector {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.page-selector:focus {
  background: rgba(255, 255, 255, 0.15);
  border-color: #FFD700;
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.1);
}

.page-selector option {
  background: #0B198F;
  color: white;
  padding: 8px;
}

.page-title-input {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  min-width: 180px;
  outline: none;
  transition: all 0.2s;
}

.page-title-input:focus {
  background: rgba(255, 255, 255, 0.15);
  border-color: #FFD700;
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.1);
}

.page-title-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.status-chip {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.status-chip.draft {
  background: rgba(255, 215, 0, 0.2);
  color: #FFD700;
}

.status-chip.saving {
  background: rgba(59, 130, 246, 0.2);
  color: #60A5FA;
}

.status-chip.saved {
  background: rgba(34, 197, 94, 0.2);
  color: #4ADE80;
}

.status-chip.published {
  background: rgba(34, 197, 94, 0.2);
  color: #4ADE80;
}

.cb-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.device-group {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 4px;
}

.cb-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 14px;
}

.cb-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.cb-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.cb-btn.active {
  background: rgba(206, 17, 38, 0.3);
  color: white;
}

.zoom-control {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 4px;
  gap: 2px;
}

.zoom-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 11px;
}

.zoom-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.zoom-value {
  font-size: 12px;
  font-weight: 700;
  color: white;
  padding: 0 8px;
  min-width: 48px;
  text-align: center;
  cursor: pointer;
  user-select: none;
}

.zoom-value:hover {
  color: #FFD700;
}

.save-btn {
  background: rgba(255, 255, 255, 0.1);
}

.save-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.publish-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #CE1126 0%, #8B0000 100%);
  border: none;
  color: white;
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(206, 17, 38, 0.4);
}

.publish-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #E01530 0%, #A00015 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(206, 17, 38, 0.5);
}

.publish-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>