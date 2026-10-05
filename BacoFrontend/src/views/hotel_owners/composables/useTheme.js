import { ref } from 'vue'

const OWNER_KEY = 'baco_theme'
const LEGACY_KEY = 'owner-theme'

function storedTheme() {
  try {
    const saved = localStorage.getItem(OWNER_KEY) || localStorage.getItem(LEGACY_KEY)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    return null
  }
}

function domTheme() {
  return document.documentElement.getAttribute('data-theme')
}

function defaultTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'dark'
  }
}

// Single source of truth shared by every useTheme() consumer so the header
// and sidebar toggles can never disagree about the current mode.
const isDarkMode = ref((domTheme() || storedTheme() || defaultTheme()) === 'dark')

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(OWNER_KEY, theme)
    localStorage.setItem(LEGACY_KEY, theme)
  } catch {
    /* storage unavailable - attribute is still applied */
  }
  isDarkMode.value = theme === 'dark'
}

export function useTheme() {
  const setTheme = (isDark) => applyTheme(isDark ? 'dark' : 'light')
  const toggleTheme = () => applyTheme(isDarkMode.value ? 'light' : 'dark')
  const initTheme = () => applyTheme(storedTheme() || defaultTheme())

  return { isDarkMode, toggleTheme, setTheme, initTheme }
}

// Stay in sync if the theme is switched by any other part of the app
// (user portal, OS listener in main.js, etc.) while the owner UI is mounted.
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  new MutationObserver(() => {
    const t = domTheme()
    if (t === 'light' || t === 'dark') isDarkMode.value = t === 'dark'
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
}