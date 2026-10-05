<script setup>
import { ref, computed } from 'vue'
import { useEditorStore } from '../store'
import { sectionRegistry } from '../registry'

const store = useEditorStore()
const isOpen = ref(false)

const availableSections = computed(() => {
  return Object.entries(sectionRegistry).map(([key, value]) => ({
    type: key,
    ...value
  }))
})

const addSection = (type) => {
  store.addSection(type)
  isOpen.value = false
}
</script>

<template>
  <div class="section-adder">
    <button class="trigger-btn" @click="isOpen = !isOpen">
      <span class="plus-icon">+</span>
      Add New Section
    </button>

    <Transition name="fade">
      <div v-if="isOpen" class="popover">
        <div class="popover-header">
          <h4>Select a Block</h4>
          <button class="close-btn" @click="isOpen = false">✕</button>
        </div>
        <div class="popover-grid">
          <button 
            v-for="sec in availableSections" 
            :key="sec.type"
            class="block-option"
            @click="addSection(sec.type)"
          >
            <span class="block-icon">{{ sec.icon }}</span>
            <span class="block-label">{{ sec.label }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.section-adder {
  position: relative;
  padding: 24px;
  text-align: center;
  border-top: 2px dashed #cbd5e1;
  margin-top: 20px;
}

.trigger-btn {
  background: white;
  border: 2px dashed #3b82f6;
  color: #3b82f6;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.trigger-btn:hover {
  background: #eff6ff;
  border-style: solid;
}

.plus-icon {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.popover {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  width: 320px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
  z-index: 100;
  overflow: hidden;
}

.popover-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
}

.popover-header h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #475569;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 14px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover { background: #e2e8f0; color: #0f172a; }

.popover-grid {
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.block-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
}

.block-option:hover {
  border-color: #3b82f6;
  background: #eff6ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.block-icon {
  font-size: 24px;
}

.block-label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  text-align: center;
}

/* Transition */
.fade-enter-active, .fade-leave-active { transition: all 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translate(-50%, 10px); }
</style>