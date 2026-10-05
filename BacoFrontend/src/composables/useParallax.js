// src/composables/useParallax.js
import { onBeforeUnmount } from 'vue'

// ── Global intensity multiplier ──────────────────────────
// 1 = original speeds, 2 = double, 3 = triple, etc.
// Tune this single number to make parallax more/less aggressive.
const SPEED_MULTIPLIER = 1

export function useParallax() {
  let rafId = null

  function handleScroll() {
    const scrollY   = window.scrollY
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const progress  = maxScroll > 0 ? scrollY / maxScroll : 0

    // Progress bar
    const bar = document.getElementById('scroll-progress')
    if (bar) bar.style.transform = `scaleX(${progress})`

    const wh = window.innerHeight

    // 1. Classic background parallax
    document.querySelectorAll('.parallax-bg[data-speed]').forEach(bg => {
      const parent = bg.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      if (rect.top < wh && rect.bottom > 0) {
        const speed = (parseFloat(bg.dataset.speed) || 0.15) * SPEED_MULTIPLIER
        bg.style.transform = `translate3d(0, ${rect.top * speed}px, 0)`
      }
    })

    // 2. Image-reveal parallax
    document.querySelectorAll('.img-reveal-img[data-speed]').forEach(img => {
      const parent = img.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      if (rect.top < wh && rect.bottom > 0) {
        const speed = (parseFloat(img.dataset.speed) || 0.1) * SPEED_MULTIPLIER
        const dist  = (rect.top + rect.height / 2) - (wh / 2)
        img.style.transform = `translate3d(0, ${dist * speed}px, 0)`
      }
    })

    // 3. Floating parallax objects — preserve CSS rotate/scale
    document.querySelectorAll('.parallax-object[data-speed]').forEach(obj => {
      const rect = obj.getBoundingClientRect()
      if (rect.top < wh + 300 && rect.bottom > -300) {
        const speed = (parseFloat(obj.dataset.speed) || 0.1) * SPEED_MULTIPLIER
        const dist  = (rect.top + rect.height / 2) - (wh / 2)
        const yOff  = dist * speed
        // Strip previous translate3d we set, keep other transforms (rotate, scale)
        const existing = obj.style.transform || ''
        const base = existing.replace(/translate3d\([^)]*\)/g, '').trim()
        obj.style.transform = base
          ? `${base} translate3d(0, ${yOff}px, 0)`
          : `translate3d(0, ${yOff}px, 0)`
      }
    })
  }

  function startRAF() {
    function tick() {
      handleScroll()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  function stopRAF() {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onBeforeUnmount(stopRAF)

  return { handleScroll, startRAF, stopRAF }
}