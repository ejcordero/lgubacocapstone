import { defineStore } from 'pinia'
import { sectionRegistry, getSectionDefaults } from './registry'
import { persistence } from './persistence'
import { pageBlueprints } from './blueprints'

const generateId = () => `sec_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const MAX_HISTORY = 60

export const useEditorStore = defineStore('editor', {
  state: () => ({
    currentSlug: 'home',
    pages: {},
    selectedId: null,
    device: 'desktop',
    zoom: 100,
    isDirty: false,
    isSaving: false,
    undoStack: [],
    redoStack: [],
    lastSaved: null,
    lastPublished: null
  }),

  getters: {
    currentPage: (state) => state.pages[state.currentSlug],
    sections: (state) => {
      const page = state.pages[state.currentSlug]
      return page ? page.sections : []
    },
    selectedSection: (state) => {
      const page = state.pages[state.currentSlug]
      return page ? page.sections.find(s => s.id === state.selectedId) : null
    },
    registry: () => sectionRegistry,
    canUndo: (state) => state.undoStack.length > 0,
    canRedo: (state) => state.redoStack.length > 0
  },

  actions: {
    async load(slug = 'home') {
      this.currentSlug = slug
      this.selectedId = null
      this.isDirty = false
      
      const draft = await persistence.loadDraft(slug)
      if (draft && draft.sections) {
        this.pages[slug] = draft
      } else {
        // Initialize with blueprint
        const blueprint = pageBlueprints[slug] || []
        this.pages[slug] = {
          slug,
          sections: blueprint.map(type => ({
            id: generateId(),
            type,
            props: getSectionDefaults(type),
            visible: true
          }))
        }
      }
    },

    switchPage(slug) {
      if (this.currentSlug !== slug) {
        this.currentSlug = slug
        this.selectedId = null
        this.load(slug)
      }
    },

    select(id) {
      this.selectedId = id
    },

    updateProp(id, key, value) {
      const page = this.currentPage
      if (!page) return
      
      const section = page.sections.find(s => s.id === id)
      if (section) {
        section.props[key] = value
        this.isDirty = true
      }
    },

    addSection(type, index = this.sections.length) {
      this.pushHistory('Add section')
      const newSection = {
        id: generateId(),
        type,
        props: getSectionDefaults(type),
        visible: true
      }
      const page = this.currentPage
      if (!page) return
      
      page.sections.splice(index, 0, newSection)
      this.selectedId = newSection.id
      this.isDirty = true
    },

    removeSection(id) {
      const page = this.currentPage
      if (!page) return
      
      const index = page.sections.findIndex(s => s.id === id)
      if (index !== -1) {
        this.pushHistory('Remove section')
        page.sections.splice(index, 1)
        if (this.selectedId === id) this.selectedId = null
        this.isDirty = true
      }
    },

    moveSection(id, direction) {
      const page = this.currentPage
      if (!page) return
      
      const index = page.sections.findIndex(s => s.id === id)
      const newIndex = index + direction
      if (newIndex >= 0 && newIndex < page.sections.length) {
        this.pushHistory('Move section')
        const [moved] = page.sections.splice(index, 1)
        page.sections.splice(newIndex, 0, moved)
        this.isDirty = true
      }
    },

    duplicateSection(id) {
      const page = this.currentPage
      if (!page) return
      
      const index = page.sections.findIndex(s => s.id === id)
      if (index !== -1) {
        this.pushHistory('Duplicate section')
        const original = page.sections[index]
        const clone = {
          ...original,
          id: generateId(),
          props: { ...original.props }
        }
        page.sections.splice(index + 1, 0, clone)
        this.selectedId = clone.id
        this.isDirty = true
      }
    },

    toggleVisibility(id) {
      const page = this.currentPage
      if (!page) return
      
      const section = page.sections.find(s => s.id === id)
      if (section) {
        this.pushHistory('Toggle visibility')
        section.visible = !section.visible
        this.isDirty = true
      }
    },

    pushHistory(action) {
      const snapshot = JSON.parse(JSON.stringify(this.pages[this.currentSlug]))
      this.undoStack.push({ snapshot, action, time: new Date() })
      if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift()
      this.redoStack = []
    },

    undo() {
      if (!this.undoStack.length) return
      const currentSnapshot = JSON.parse(JSON.stringify(this.pages[this.currentSlug]))
      this.redoStack.push({ snapshot: currentSnapshot, action: 'redo', time: new Date() })
      
      const entry = this.undoStack.pop()
      this.pages[this.currentSlug] = entry.snapshot
      this.selectedId = null
      this.isDirty = true
    },

    redo() {
      if (!this.redoStack.length) return
      const currentSnapshot = JSON.parse(JSON.stringify(this.pages[this.currentSlug]))
      this.undoStack.push({ snapshot: currentSnapshot, action: 'undo', time: new Date() })
      
      const entry = this.redoStack.pop()
      this.pages[this.currentSlug] = entry.snapshot
      this.selectedId = null
      this.isDirty = true
    },

    async saveDraft() {
      this.isSaving = true
      await persistence.saveDraft(this.currentSlug, this.pages[this.currentSlug])
      this.isDirty = false
      this.isSaving = false
      this.lastSaved = new Date()
    },

    async publish() {
      this.isSaving = true
      await persistence.publish(this.currentSlug, this.pages[this.currentSlug])
      this.isDirty = false
      this.isSaving = false
      this.lastPublished = new Date()
    },

    setZoom(zoom) {
      this.zoom = Math.max(50, Math.min(150, zoom))
    }
  }
})