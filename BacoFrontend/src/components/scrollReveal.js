import { ref, onMounted, onUnmounted } from 'vue'

export function useScrollReveal() {
  const observer = ref(null)
  
  const observeElement = (element) => {
    if (!element) return
    
    observer.value = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed')
          if (observer.value) {
            observer.value.unobserve(entry.target)
          }
        }
      })
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    })
    
    observer.value.observe(element)
  }
  
  onUnmounted(() => {
    if (observer.value) {
      observer.value.disconnect()
    }
  })
  
  return { observeElement }
}