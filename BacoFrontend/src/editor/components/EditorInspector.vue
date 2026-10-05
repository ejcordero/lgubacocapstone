<script setup>
import { computed } from 'vue'
import { useEditorStore } from '../store'
import { sectionRegistry } from '../registry'

const store = useEditorStore()

const section = computed(() => store.selectedSection)
const registry = computed(() => section.value ? sectionRegistry[section.value.type] : null)

const updateField = (key, value) => {
  if (section.value) {
    store.updateProp(section.value.id, key, value)
  }
}
</script>

<template>
  <aside class="editor-inspector">
    <div v-if="section && registry" class="inspector-content">
      <div class="inspector-header">
        <div class="header-icon">
          <i class="fa-solid" :class="registry.icon"></i>
        </div>
        <div class="header-info">
          <h3>{{ registry.label }}</h3>
          <span class="type-badge">{{ section.type }}</span>
        </div>
        <div class="header-actions">
          <button @click="store.duplicateSection(section.id)" title="Duplicate">
            <i class="fa-solid fa-clone"></i>
          </button>
          <button @click="store.removeSection(section.id)" title="Delete" class="danger">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>

      <div class="inspector-body">
        <div class="inspector-section">
          <div class="section-title">Content</div>
          
          <div v-for="field in registry.fields" :key="field.key" class="field-group">
            <label>{{ field.label }}</label>
            
            <textarea
              v-if="field.type === 'textarea'"
              :value="section.props[field.key]"
              @input="updateField(field.key, $event.target.value)"
              rows="4"
            ></textarea>
            
            <input
              v-else
              type="text"
              :value="section.props[field.key]"
              @input="updateField(field.key, $event.target.value)"
            />
          </div>
        </div>

        <div class="inspector-section">
          <div class="section-title">Visibility</div>
          <label class="toggle-field">
            <input
              type="checkbox"
              :checked="section.visible"
              @change="store.toggleVisibility(section.id)"
            />
            <span class="toggle-slider"></span>
            <span>{{ section.visible ? 'Visible' : 'Hidden' }}</span>
          </label>
        </div>
      </div>
    </div>

    <div v-else class="inspector-empty">
      <i class="fa-solid fa-sliders"></i>
      <p>Select a section on the canvas to edit its properties</p>
    </div>
  </aside>
</template>

<style scoped>
.editor-inspector {
  width: 320px;
  background: white;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.inspector-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.inspector-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #0B198F 0%, #1e40af 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  flex-shrink: 0;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.header-info h3 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 700;
  color: #0B198F;
}

.type-badge {
  display: inline-block;
  background: #e2e8f0;
  color: #64748b;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.header-actions button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.header-actions button:hover {
  background: #f8fafc;
  border-color: #0B198F;
  color: #0B198F;
}

.header-actions button.danger:hover {
  background: #fef2f2;
  border-color: #dc2626;
  color: #dc2626;
}

.inspector-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.inspector-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.field-group {
  margin-bottom: 16px;
}

.field-group label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
}

.field-group input,
.field-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  color: #1e293b;
  transition: all 0.15s;
  box-sizing: border-box;
}

.field-group input:focus,
.field-group textarea:focus {
  outline: none;
  border-color: #0B198F;
  box-shadow: 0 0 0 3px rgba(11, 25, 143, 0.1);
}

.field-group textarea {
  resize: vertical;
  min-height: 80px;
}

.toggle-field {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.toggle-field input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-slider {
  position: relative;
  width: 40px;
  height: 22px;
  background: #cbd5e1;
  border-radius: 11px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-field input:checked + .toggle-slider {
  background: #0B198F;
}

.toggle-field input:checked + .toggle-slider::after {
  transform: translateX(18px);
}

.toggle-field span {
  font-size: 13px;
  color: #334155;
}

.inspector-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #94a3b8;
}

.inspector-empty i {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.3;
}

.inspector-empty p {
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}
</style>