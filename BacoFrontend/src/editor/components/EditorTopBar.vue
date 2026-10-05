<script setup>
import { useEditorStore } from '../store'

const store = useEditorStore()

const devices = [
  { id: 'desktop', icon: '🖥️', label: 'Desktop' },
  { id: 'tablet', icon: '📱', label: 'Tablet' },
  { id: 'mobile', icon: '📲', label: 'Mobile' }
]
</script>

<template>
  <header class="editor-topbar">
    <div class="topbar-left">
      <span class="brand">🛠️ Baco Visual Editor</span>
      <span class="page-badge">{{ store.slug.toUpperCase() }}</span>
      <span v-if="store.isDirty" class="dirty-indicator">● Unsaved changes</span>
    </div>

    <div class="topbar-center">
      <button 
        v-for="dev in devices" 
        :key="dev.id"
        class="device-btn"
        :class="{ active: store.device === dev.id }"
        @click="store.device = dev.id"
        :title="dev.label"
      >
        {{ dev.icon }}
      </button>
    </div>

    <div class="topbar-right">
      <button class="btn btn-secondary" :disabled="store.isSaving" @click="store.saveDraft">
        {{ store.isSaving ? 'Saving...' : 'Save Draft' }}
      </button>
      <button class="btn btn-primary" :disabled="store.isSaving" @click="store.publish">
        Publish Live
      </button>
    </div>
  </header>
</template>

<style scoped>
.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 24px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
  color: #e2e8f0;
  flex-shrink: 0;
}

.topbar-left { display: flex; align-items: center; gap: 12px; }
.brand { font-weight: 700; font-size: 14px; }
.page-badge { 
  background: #1e293b; padding: 4px 8px; border-radius: 4px; 
  font-size: 11px; font-weight: 600; letter-spacing: 0.05em; 
}
.dirty-indicator { color: #fbbf24; font-size: 12px; font-weight: 500; }

.topbar-center { display: flex; gap: 4px; background: #1e293b; padding: 4px; border-radius: 8px; }
.device-btn {
  background: transparent; border: none; color: #94a3b8;
  padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 16px;
  transition: all 0.2s;
}
.device-btn:hover { color: #e2e8f0; }
.device-btn.active { background: #3b82f6; color: white; }

.topbar-right { display: flex; gap: 8px; }
.btn {
  padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: none; transition: all 0.2s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: #334155; color: #e2e8f0; }
.btn-secondary:hover:not(:disabled) { background: #475569; }
.btn-primary { background: #2563eb; color: white; }
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
</style>