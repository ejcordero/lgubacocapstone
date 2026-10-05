import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '../api'

export const usePermitStore = defineStore('permit', () => {
  // Initialize as EMPTY ARRAYS to prevent "forEach is not a function" crashes
  const myPermits = ref([])
  const selectedPermit = ref(null)
  const step = ref('list') // list | apply | tracker
  const loading = ref(false)

  async function fetchPermits() {
    loading.value = true
    try {
      const token = localStorage.getItem('baco_user_token')
      if (!token) return // Don't fetch if not logged in
      
      const res = await fetch(`${API}/halcon/permits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (res.status === 401) return // Token expired, ignore
      if (!res.ok) throw new Error('Failed to fetch')
      
      const data = await res.json()
      // Ensure we always set an array, even if the DB returns null
      myPermits.value = Array.isArray(data) ? data : []
    } catch (e) {
      console.error('Fetch permits error:', e)
      myPermits.value = [] // Fallback to empty array on error
    } finally {
      loading.value = false
    }
  }

  async function fetchPermitById(id) {
    if (!id) return null
    loading.value = true
    try {
      const token = localStorage.getItem('baco_user_token')
      if (!token) return null

      const res = await fetch(`${API}/halcon/permits/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch')
      
      const data = await res.json()
      selectedPermit.value = data
      return data
    } catch (e) {
      console.error('Fetch permit error:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchPermitByCode(code) {
    if (!code || code === 'undefined') return null // Safety check for undefined codes
    loading.value = true
    try {
      const token = localStorage.getItem('baco_user_token')
      if (!token) return null

      const res = await fetch(`${API}/halcon/permit-by-code/${code}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch')
      
      const data = await res.json()
      selectedPermit.value = data
      return data
    } catch (e) {
      console.error('Fetch permit by code error:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  function selectPermit(permit) {
    selectedPermit.value = permit
    step.value = 'tracker'
  }

  function goToStep(s) {
    step.value = s
  }

  function resetFlow() {
    selectedPermit.value = null
    step.value = 'list'
  }

  return {
    myPermits,
    selectedPermit,
    step,
    loading,
    fetchPermits,
    fetchPermitById,
    fetchPermitByCode,
    selectPermit,
    goToStep,
    resetFlow,
  }
})