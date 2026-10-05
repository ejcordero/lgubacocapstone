// ─────────────────────────────────────────────────────────
//  scrollAnimations.js
//  Core GSAP + Lenis composable.
//  Import and call initScrollAnimations() from Home.vue's onMounted.
// ─────────────────────────────────────────────────────────
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

// ── Lenis instance (exported so components can hook into it) ──
export let lenis = null

// Shared Lenis/GSAP ticker bridge. Referenced by identity from both the add and
// the remove, which is the only way the removal can actually match.
const lenisTicker = (time) => { if (lenis) lenis.raf(time * 1000) }

// ─────────────────────────────────────────────────────────
//  initLenis
//  Creates a smooth-scroll instance and ties it to GSAP's
//  ticker so ScrollTrigger stays in sync.
// ─────────────────────────────────────────────────────────
export function initLenis() {
  lenis = new Lenis({
    duration: 1.3,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    smoothWheel: true,
  })

  // Connect Lenis RAF to GSAP ticker. Uses the shared handler by reference so
  // teardown can remove the same function -- gsap.ticker matches by identity.
  gsap.ticker.add(lenisTicker)
  gsap.ticker.lagSmoothing(0)

  return lenis
}

// ─────────────────────────────────────────────────────────
//  initStackingSections
//  Makes each .stack-section pin and let the NEXT section
//  slide over it — the "deck of cards" effect.
//
//  Expects sections to have the class .stack-section
//  and be direct children of .home-layout
// ─────────────────────────────────────────────────────────
export function initStackingSections() {
  const sections = gsap.utils.toArray('.stack-section')

  sections.forEach((section, i) => {
    // Every section except the last one gets pinned
    if (i === sections.length - 1) return

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      // Pin until the NEXT section has fully slid over
      end: () => `+=${sections[i + 1]?.offsetHeight ?? window.innerHeight}`,
      pin: true,
      pinSpacing: false,
      anticipatePin: 1,
      id: `stack-pin-${i}`,
    })
  })
}

// ─────────────────────────────────────────────────────────
//  initHeroParallax
//  Subtle scale on the hero section as user scrolls away.
// ─────────────────────────────────────────────────────────
export function initHeroParallax() {
  const hero = document.querySelector('.hero')
  if (!hero) return

  gsap.to(hero, {
    scale: 1.04,
    filter: 'brightness(0.7)',
    ease: 'none',
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  })
}

// ─────────────────────────────────────────────────────────
//  initSectionSlideIn
//  Each non-hero stack-section slides UP from slightly below
//  as it enters the viewport, giving the "sliding over" feel.
// ─────────────────────────────────────────────────────────
export function initSectionSlideIn() {
  const sections = gsap.utils.toArray('.stack-section:not(.hero-section)')

  sections.forEach((section) => {
    gsap.fromTo(
      section,
      { yPercent: 6, opacity: 0.85 },
      {
        yPercent: 0,
        opacity: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 95%',
          end: 'top 30%',
          scrub: 0.6,
        },
      }
    )
  })
}

// ─────────────────────────────────────────────────────────
//  initStaggeredReveals
//  Replaces the IntersectionObserver .reveal logic with GSAP.
//  Looks for any .gsap-reveal inside .stack-section.
// ─────────────────────────────────────────────────────────
export function initStaggeredReveals() {
  const groups = gsap.utils.toArray('.stack-section')

  groups.forEach((section) => {
    const items = section.querySelectorAll('.gsap-reveal')
    if (!items.length) return

    gsap.fromTo(
      items,
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.75,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      }
    )
  })
}

// ─────────────────────────────────────────────────────────
//  initStatsCounter
//  Animates the numeric stat values counting up.
// ─────────────────────────────────────────────────────────
export function initStatsCounter() {
  const statValues = document.querySelectorAll('.stat-value')
  if (!statValues.length) return

  statValues.forEach((el) => {
    // Extract the raw number (strip commas)
    const raw = el.textContent.replace(/,/g, '').trim()
    const num = parseFloat(raw)
    if (isNaN(num)) return

    const hasComma = el.textContent.includes(',')
    const obj = { val: 0 }

    gsap.to(obj, {
      val: num,
      duration: 1.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
      onUpdate() {
        el.textContent = hasComma
          ? Math.round(obj.val).toLocaleString()
          : Math.round(obj.val).toString()
      },
    })
  })
}

// ─────────────────────────────────────────────────────────
//  initScrollAnimations  ← call this one from Home.vue
// ─────────────────────────────────────────────────────────
export function initScrollAnimations() {
  initLenis()
  initHeroParallax()
  initStackingSections()
  initSectionSlideIn()
  initStaggeredReveals()
  initStatsCounter()
}

// ─────────────────────────────────────────────────────────
//  cleanup  ← call this from Home.vue's onBeforeUnmount
// ─────────────────────────────────────────────────────────
export function destroyScrollAnimations() {
  ScrollTrigger.getAll().forEach((st) => st.kill())
  if (lenis) {
    lenis.destroy()
    lenis = null
  }
  gsap.ticker.remove(lenisTicker)
}
