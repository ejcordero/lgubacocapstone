<script setup>
import { ref, computed } from 'vue'
import { useEditorStore } from '../store'
import { sectionRegistry, categoryLabels } from '../registry'

const store = useEditorStore()
const activeTab = ref('blocks')

const tabs = [
  { id: 'blocks', label: 'Blocks', icon: 'fa-cubes' },
  { id: 'pages', label: 'Pages', icon: 'fa-file' },
  { id: 'layers', label: 'Layers', icon: 'fa-layer-group' }
]

const availableBlocks = computed(() => {
  const allBlocks = Object.entries(sectionRegistry).map(([key, value]) => ({
    type: key,
    ...value
  }))

  // If on Home page, show modular sections only
  if (store.currentSlug === 'home') {
    return allBlocks.filter(b => b.category !== 'page')
  }
  
  // For other pages, show only their specific full-page block
  const pageBlockMap = {
    officials: 'OfficialsPage',
    news: 'NewsPage',
    history: 'HistoryPage',
    barangays: 'BarangaysPage',
    municipality: 'MunicipalityPage'
  }
  
  const targetBlock = pageBlockMap[store.currentSlug]
  return targetBlock ? allBlocks.filter(b => b.type === targetBlock) : []
})

const groupedBlocks = computed(() => {
  const groups = {}
  availableBlocks.value.forEach(block => {
    const cat = block.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(block)
  })
  return groups
})
</script>

<template>
  <aside class="left-panel">
    <div class="panel-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="panel-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <i class="fa-solid" :class="tab.icon"></i>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div class="panel-content">
      <!-- Blocks Tab -->
      <div v-if="activeTab === 'blocks'" class="blocks-panel">
        <div class="panel-header">
          <h3>Available Blocks</h3>
          <p class="panel-subtitle">Click to add to canvas</p>
        </div>
        
        <div v-if="Object.keys(groupedBlocks).length === 0" class="empty-state">
          <i class="fa-solid fa-info-circle"></i>
          <p>This page uses a full-page layout. Switch to Home for modular editing.</p>
        </div>

        <div v-else v-for="(blocks, category) in groupedBlocks" :key="category" class="block-group">
          <div class="group-label">{{ categoryLabels[category] || category }}</div>
          <div class="blocks-list">
            <button
              v-for="block in blocks"
              :key="block.type"
              class="block-item"
              @click="store.addSection(block.type)"
            >
              <div class="block-icon">
                <i class="fa-solid" :class="block.icon"></i>
              </div>
              <span class="block-label">{{ block.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Pages Tab -->
      <div v-if="activeTab === 'pages'" class="pages-panel">
        <div class="panel-header">
          <h3>Site Pages</h3>
        </div>
        
        <div class="pages-list">
          <div
            v-for="(pageData, slug) in store.pages"
            :key="slug"
            class="page-item"
            :class="{ active: slug === store.currentSlug }"
            @click="store.switchPage(slug)"
          >
            <i class="fa-solid fa-file-lines"></i>
            <span class="page-name">{{ slug }}</span>
            <span class="page-status draft">DFT</span>
          </div>
        </div>
      </div>

      <!-- Layers Tab -->
      <div v-if="activeTab === 'layers'" class="layers-panel">
        <div class="panel-header">
          <h3>Page Layers</h3>
          <span class="layer-count">{{ store.sections.length }}</span>
        </div>
        
        <div class="layers-list">
          <div
            v-for="(section, index) in store.sections"
            :key="section.id"
            class="layer-item"
            :class="{
              active: store.selectedId === section.id,
              hidden: !section.visible
            }"
            @click="store.select(section.id)"
          >
            <i class="fa-solid" :class="sectionRegistry[section.type]?.icon"></i>
            <span class="layer-name">{{ sectionRegistry[section.type]?.label }}</span>
            
            <div class="layer-actions" v-if="store.selectedId === section.id">
              <button
                @click.stop="store.moveSection(section.id, -1)"
                :disabled="index === 0"
                title="Move Up"
              >
                <i class="fa-solid fa-chevron-up"></i>
              </button>
              <button
                @click.stop="store.moveSection(section.id, 1)"
                :disabled="index === store.sections.length - 1"
                title="Move Down"
              >
                <i class="fa-solid fa-chevron-down"></i>
              </button>
              <button
                @click.stop="store.toggleVisibility(section.id)"
                :title="section.visible ? 'Hide' : 'Show'"
              >
                <i class="fa-solid" :class="section.visible ? 'fa-eye' : 'fa-eye-slash'"></i>
              </button>
            </div>
          </div>
          
          <div v-if="store.sections.length === 0" class="empty-state">
            <i class="fa-solid fa-layer-group"></i>
            <p>No sections on this page</p>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.left-panel {
  width: 280px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.panel-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.panel-tab:hover {
  color: #0B198F;
  background: rgba(11, 25, 143, 0.05);
}

.panel-tab.active {
  color: #0B198F;
  border-bottom-color: #CE1126;
  background: white;
}

.panel-tab i {
  font-size: 16px;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #0B198F;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.panel-subtitle {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
}

.blocks-panel {
  padding: 16px;
}

.block-group {
  margin-bottom: 20px;
}

.group-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 8px;
  padding: 0 4px;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.block-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.block-item:hover {
  background: #f8fafc;
  border-color: #0B198F;
  transform: translateX(2px);
}

.block-icon {
  width: 32px;
  height: 32px;
  background: #eff6ff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0B198F;
  font-size: 14px;
  flex-shrink: 0;
}

.block-label {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
}

.pages-panel {
  padding: 16px;
}

.pages-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.page-item:hover {
  background: #f8fafc;
  border-color: #0B198F;
}

.page-item.active {
  background: #eff6ff;
  border-color: #0B198F;
}

.page-item i {
  color: #0B198F;
  font-size: 14px;
}

.page-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  text-transform: capitalize;
}

.page-status {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  letter-spacing: 0.5px;
}

.page-status.draft {
  background: rgba(255, 215, 0, 0.2);
  color: #D4AF37;
}

.page-status.published {
  background: rgba(34, 197, 94, 0.2);
  color: #16a34a;
}

.layers-panel {
  padding: 16px;
}

.layer-count {
  background: #e2e8f0;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}

.layers-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: white;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.layer-item:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.layer-item.active {
  background: #eff6ff;
  border-color: #0B198F;
}

.layer-item.hidden {
  opacity: 0.5;
}

.layer-item i {
  color: #0B198F;
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.layer-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
}

.layer-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.layer-actions button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  color: #64748b;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.layer-actions button:hover:not(:disabled) {
  background: #0B198F;
  color: white;
  border-color: #0B198F;
}

.layer-actions button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
}

.empty-state i {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.3;
  display: block;
}

.empty-state p {
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
}
</style>