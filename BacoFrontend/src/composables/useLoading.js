import { ref } from 'vue'

export function useLoading(initialState = false) {
  const isLoading = ref(initialState)

  async function withLoading(action) {
    isLoading.value = true
    try {
      return await action()
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, withLoading }
}