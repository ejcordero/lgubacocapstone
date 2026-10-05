const getDraftKey = (slug) => `baco_editor_draft_${slug}`
const getPublishedKey = (slug) => `baco_editor_published_${slug}`

export const persistence = {
  async loadDraft(slug) {
    try {
      const data = localStorage.getItem(getDraftKey(slug))
      return data ? JSON.parse(data) : null
    } catch (e) {
      console.error('Failed to load draft:', e)
      return null
    }
  },

  async saveDraft(slug, data) {
    try {
      localStorage.setItem(getDraftKey(slug), JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save draft:', e)
    }
  },

  async publish(slug, data) {
    try {
      // Save to published key, and also update draft to match
      localStorage.setItem(getPublishedKey(slug), JSON.stringify(data))
      localStorage.setItem(getDraftKey(slug), JSON.stringify(data))
    } catch (e) {
      console.error('Failed to publish:', e)
    }
  },

  async loadPublished(slug) {
    try {
      const data = localStorage.getItem(getPublishedKey(slug))
      return data ? JSON.parse(data) : null
    } catch (e) {
      console.error('Failed to load published:', e)
      return null
    }
  }
}