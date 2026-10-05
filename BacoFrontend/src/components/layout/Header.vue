<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute() // CHANGED: used for route watching (replaces router.afterEach leak)

const isMobileMenuOpen = ref(false)
const isLight = ref(false)
const isScrolled = ref(false)

const activeDropdowns = ref(new Set())
const flippedSubs = ref(new Set())

const toggleDropdown = (name) => {
  const s = new Set(activeDropdowns.value)
  if (s.has(name)) {
    s.delete(name)
  } else {
    s.add(name)
  }
  activeDropdowns.value = s
}

const checkSubSpace = (event, name) => {
  const rect = event.currentTarget.getBoundingClientRect()
  const subMenuWidth = 210
  const s = new Set(flippedSubs.value)
  if ((window.innerWidth - rect.right) < subMenuWidth) {
    s.add(name)
  } else {
    s.delete(name)
  }
  flippedSubs.value = s
}

const openDropdowns = ref(new Set())
const toggleMobileDropdown = (name) => {
  const s = new Set(openDropdowns.value)
  if (s.has(name)) {
    s.delete(name)
  } else {
    s.add(name)
  }
  openDropdowns.value = s
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (!isMobileMenuOpen.value) openDropdowns.value = new Set()
}

const closeAll = () => {
  activeDropdowns.value = new Set()
  openDropdowns.value = new Set()
  isMobileMenuOpen.value = false
  flippedSubs.value = new Set()
}

const handleClickOutside = (e) => {
  if (!e.target.closest('.site-header') && !e.target.closest('.mobile-sidebar')) {
    activeDropdowns.value = new Set()
    openDropdowns.value = new Set()
    isMobileMenuOpen.value = false
    flippedSubs.value = new Set()
  }
}

const handleScroll = () => {
  isScrolled.value = window.scrollY > 20
}

// CHANGED: Escape key closes all menus (keyboard accessibility)
const handleKeydown = (e) => {
  if (e.key === 'Escape') closeAll()
}

const handleLogoGroupClick = () => {
  if (window.innerWidth <= 960 && isScrolled.value) {
    toggleMobileMenu()
  } else {
    router.push('/')
    closeAll()
  }
}

let observer = null

const initObserver = () => {
  const sections = document.querySelectorAll('[data-theme]')
  if (!sections.length) return

  const HEADER_H = 58

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isLight.value = entry.target.dataset.theme === 'light'
        }
      })
    },
    {
      rootMargin: `-${HEADER_H}px 0px -${window.innerHeight - HEADER_H - 1}px 0px`,
      threshold: 0,
    }
  )

  sections.forEach((sec) => observer.observe(sec))
}

const handleRouteChange = () => {
  closeAll()
  if (observer) observer.disconnect()
  isLight.value = false
  setTimeout(initObserver, 150)
}

// CHANGED: was `router.afterEach(...)` registered with no cleanup (leaked on
// every remount). A `watch` inside setup auto-disposes with the component.
watch(() => route.fullPath, handleRouteChange)

watch(isMobileMenuOpen, (val) => {
  if (val) {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  } else {
    const scrollY = parseInt(document.body.style.top || '0') * -1
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.overflow = ''
    document.documentElement.style.overflow = ''
    window.scrollTo(0, scrollY)
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // CHANGED: passive scroll listener (scroll handler never calls preventDefault)
  window.addEventListener('scroll', handleScroll, { passive: true })
  document.addEventListener('keydown', handleKeydown)
  setTimeout(initObserver, 100)
})

onUnmounted(() => {
  const scrollY = parseInt(document.body.style.top || '0') * -1
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
  window.scrollTo(0, scrollY)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', handleScroll)
  document.removeEventListener('keydown', handleKeydown)
  if (observer) observer.disconnect()
})
</script>

<template>
  <!-- Dark Overlay -->
  <div
    class="sidebar-overlay"
    :class="{ show: isMobileMenuOpen }"
    @click="closeAll"
  ></div>

  <!-- Glass Sidebar (Right) -->
  <aside
    class="mobile-sidebar"
    :class="{ open: isMobileMenuOpen, 'light-mode': isLight }"
    @click.stop
  >
    <div class="sidebar-accent"></div>

    <div class="sidebar-header">
      <div class="sidebar-logo" @click="router.push('/'); closeAll()">
        <div class="sidebar-seal">
          <img src="/images/BACO-SEAL.png" alt="Baco Seal" />
        </div>
        <div class="sidebar-logo-text">
          <span class="sidebar-title">Municipality of Baco</span>
          <span class="sidebar-subtitle">Province of Oriental Mindoro</span>
        </div>
      </div>
      <button class="sidebar-close" @click="closeAll" aria-label="Close menu">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <nav class="sidebar-body">
      <ul class="m-nav">
        <li class="m-item">
          <a href="#" class="m-link" @click.prevent="toggleMobileDropdown('m-about')">
            About
            <span class="m-arrow" :class="{ rotated: openDropdowns.has('m-about') }">
              <i class="fa-solid fa-chevron-down"></i>
            </span>
          </a>
          <div class="m-sub" :class="{ show: openDropdowns.has('m-about') }">
            <div>
              <ul>
                <li><router-link to="/municipality" @click="closeAll">The Municipality</router-link></li>
                <li><router-link to="/history" @click="closeAll">History</router-link></li>
                <li>
                  <a href="#" @click.prevent="toggleMobileDropdown('m-officials')">
                    Officials
                    <span class="m-arrow" :class="{ rotated: openDropdowns.has('m-officials') }">
                      <i class="fa-solid fa-chevron-down"></i>
                    </span>
                  </a>
                  <div class="m-sub m-nested" :class="{ show: openDropdowns.has('m-officials') }">
                    <div>
                      <ul>
                        <li><router-link to="/officials" @click="closeAll">Elected Officials</router-link></li>
                      </ul>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </li>

        <li class="m-item">
          <a href="#" class="m-link" @click.prevent="toggleMobileDropdown('m-gov')">
            Good Governance
            <span class="m-arrow" :class="{ rotated: openDropdowns.has('m-gov') }">
              <i class="fa-solid fa-chevron-down"></i>
            </span>
          </a>
          <div class="m-sub" :class="{ show: openDropdowns.has('m-gov') }">
            <div>
              <ul>
                <li><router-link to="/tala" @click="closeAll">Transparency</router-link></li>
                <li><router-link to="/citizens-charter" @click="closeAll">Citizen's Charter</router-link></li>
              </ul>
            </div>
          </div>
        </li>

        <li class="m-item">
          <a href="#" class="m-link" @click.prevent="toggleMobileDropdown('m-offices')">
            Offices
            <span class="m-arrow" :class="{ rotated: openDropdowns.has('m-offices') }">
              <i class="fa-solid fa-chevron-down"></i>
            </span>
          </a>
          <div class="m-sub" :class="{ show: openDropdowns.has('m-offices') }">
            <div>
              <ul>
                <li><router-link to="/alloffices" @click="closeAll">All Offices</router-link></li>
                <!-- ✅ Schools — direct item, same level as All Offices & Frontline Services -->
                <li><router-link to="/schools" @click="closeAll">Schools Directory</router-link></li>
                <li>
                  <a href="#" @click.prevent="toggleMobileDropdown('m-frontline')">
                    Frontline Services
                    <span class="m-arrow" :class="{ rotated: openDropdowns.has('m-frontline') }">
                      <i class="fa-solid fa-chevron-down"></i>
                    </span>
                  </a>
                  <div class="m-sub m-nested" :class="{ show: openDropdowns.has('m-frontline') }">
                    <div>
                      <ul>
                        <li><router-link to="/mho" @click="closeAll">Municipal Health Office</router-link></li>
                      </ul>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </li>

        <li class="m-item">
          <router-link to="/tourism" class="m-link" @click="closeAll">Tourism</router-link>
        </li>

        <li class="m-item">
          <router-link to="/news" class="m-link" @click="closeAll">News &amp; Updates</router-link>
        </li>
      </ul>
    </nav>

    <div class="sidebar-footer">
      <a href="#">e-Services</a>
      <a href="#">Full Disclosure Portal</a>
    </div>
  </aside>

  <!-- Header -->
  <header class="site-header" :class="{ 'is-scrolled': isScrolled, 'menu-open': isMobileMenuOpen }">
    <div class="header-inner">

      <!-- Logo -->
      <div class="logo-group" @click="handleLogoGroupClick">
        <div class="nav-seal">
          <img src="/images/BACO-SEAL.png" alt="Baco Seal" class="nav-seal-img" />
        </div>
        <div class="logo-text">
          <h1>Municipality of Baco</h1>
          <span>Province of Oriental Mindoro</span>
        </div>
      </div>

      <!-- Desktop Navigation -->
      <nav class="main-nav">
        <ul class="nav-links">
          <li class="has-dropdown">
            <a href="#" @click.prevent="toggleDropdown('about')" aria-haspopup="true" :aria-expanded="activeDropdowns.has('about')">
              About
              <span class="arrow" :class="{ rotated: activeDropdowns.has('about') }">
                <i class="fa-solid fa-chevron-down"></i>
              </span>
            </a>
            <ul class="dropdown" :class="{ show: activeDropdowns.has('about') }">
              <li><router-link to="/municipality" @click="closeAll">The Municipality</router-link></li>
              <li><router-link to="/history" @click="closeAll">History</router-link></li>
              <li
                class="has-sub"
                :class="{ 'flip-left': flippedSubs.has('officials') }"
                @mouseenter="checkSubSpace($event, 'officials')"
              >
                <a href="#" @click.prevent="toggleDropdown('officials')" aria-haspopup="true" :aria-expanded="activeDropdowns.has('officials')">
                  Officials
                  <span class="arrow sub-arrow" :class="{ rotated: activeDropdowns.has('officials') }">
                    <i class="fa-solid fa-chevron-right"></i>
                  </span>
                </a>
                <ul class="dropdown sub-dropdown" :class="{ show: activeDropdowns.has('officials') }">
                  <li><router-link to="/officials" @click="closeAll">Elected Officials</router-link></li>
                </ul>
              </li>
            </ul>
          </li>

          <li class="has-dropdown">
            <a href="#" @click.prevent="toggleDropdown('governance')" aria-haspopup="true" :aria-expanded="activeDropdowns.has('governance')">
              Good Governance
              <span class="arrow" :class="{ rotated: activeDropdowns.has('governance') }">
                <i class="fa-solid fa-chevron-down"></i>
              </span>
            </a>
            <ul class="dropdown" :class="{ show: activeDropdowns.has('governance') }">
              <li><router-link to="/tala" @click="closeAll">Transparency</router-link></li>
              <li><router-link to="/citizens-charter" @click="closeAll">Citizen's Charter</router-link></li>
            </ul>
          </li>

          <li class="has-dropdown">
            <a href="#" @click.prevent="toggleDropdown('offices')" aria-haspopup="true" :aria-expanded="activeDropdowns.has('offices')">
              Offices
              <span class="arrow" :class="{ rotated: activeDropdowns.has('offices') }">
                <i class="fa-solid fa-chevron-down"></i>
              </span>
            </a>
            <ul class="dropdown" :class="{ show: activeDropdowns.has('offices') }">
              <li><router-link to="/alloffices" @click="closeAll">All Offices</router-link></li>
              <!-- ✅ Schools — direct item, same level as All Offices & Frontline Services -->
              <li><router-link to="/schools" @click="closeAll">Schools Directory</router-link></li>
              <li
                class="has-sub"
                :class="{ 'flip-left': flippedSubs.has('frontline') }"
                @mouseenter="checkSubSpace($event, 'frontline')"
              >
                <a href="#" @click.prevent="toggleDropdown('frontline')" aria-haspopup="true" :aria-expanded="activeDropdowns.has('frontline')">
                  Frontline Services
                  <span class="arrow sub-arrow" :class="{ rotated: activeDropdowns.has('frontline') }">
                    <i class="fa-solid fa-chevron-right"></i>
                  </span>
                </a>
                <ul class="dropdown sub-dropdown" :class="{ show: activeDropdowns.has('frontline') }">
                  <li><router-link to="/mho" @click="closeAll">Municipal Health Office</router-link></li>
                </ul>
              </li>
            </ul>
          </li>

          <li><router-link to="/tourism" @click="closeAll">Tourism</router-link></li>
          <li><router-link to="/news" @click="closeAll">News &amp; Updates</router-link></li>
        </ul>
      </nav>

      <!-- Hamburger (mobile only) -->
      <button
        class="mobile-menu-btn"
        @click.stop="toggleMobileMenu"
        :aria-expanded="isMobileMenuOpen"
        aria-label="Toggle navigation"
      >
        <span :class="{ active: isMobileMenuOpen }"></span>
        <span :class="{ active: isMobileMenuOpen }"></span>
        <span :class="{ active: isMobileMenuOpen }"></span>
      </button>

    </div>
  </header>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

/* ─── Sidebar Overlay ────────────────────────────────── */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 495;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
.sidebar-overlay.show {
  opacity: 1;
  visibility: visible;
}

/* ─── Ultra Glass Sidebar (Right Side) ───────────────── */
.mobile-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 310px;
  max-width: 88vw;
  z-index: 510;
  display: flex;
  flex-direction: column;
  font-family: 'Poppins', sans-serif;

  background: rgba(7, 17, 94, 0.35);
  backdrop-filter: blur(48px) saturate(220%) brightness(1.1);
  -webkit-backdrop-filter: blur(48px) saturate(220%) brightness(1.1);
  border-left: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow:
    -30px 0 80px rgba(0, 0, 0, 0.25),
    inset 1px 0 0 rgba(255, 255, 255, 0.15),
    inset -1px 0 0 rgba(255, 255, 255, 0.05);

  transform: translateX(105%);
  transition: transform 0.45s cubic-bezier(0.32, 0.72, 0, 1);
}
.mobile-sidebar.open {
  transform: translateX(0);
}

/* Sidebar red accent bar */
.sidebar-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #CE1126, #ff334b, #CE1126);
  z-index: 1;
  flex-shrink: 0;
  box-shadow: 0 0 10px rgba(206, 17, 38, 0.6);
}

/* Sidebar header */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 18px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.02);
}
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 11px;
  cursor: pointer;
  text-decoration: none;
}
.sidebar-seal {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.1);
}
.sidebar-seal img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.sidebar-logo-text {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidebar-title {
  font-size: 0.72rem;
  font-weight: 600;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  transition: color 0.4s ease;
}
.sidebar-subtitle {
  font-size: 0.55rem;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.05em;
  white-space: nowrap;
  margin-top: 1px;
  transition: color 0.4s ease;
}
.sidebar-close {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.8);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.85rem;
  flex-shrink: 0;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}
.sidebar-close:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.35);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.15);
}

/* Sidebar body (scrollable) */
.sidebar-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  position: relative;
  z-index: 1;
}
.sidebar-body::-webkit-scrollbar {
  width: 4px;
}
.sidebar-body::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
.sidebar-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.35);
}

/* Sidebar nav list */
.m-nav {
  list-style: none;
  margin: 0;
  padding: 8px 0;
}
.m-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.m-item:last-child {
  border-bottom: none;
}

.m-link,
.m-item > a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 20px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.95);
  text-decoration: none;
  transition: background 0.25s ease, color 0.25s ease, padding-left 0.25s ease, text-shadow 0.25s ease;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.m-link:hover,
.m-item > a:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding-left: 24px;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

/* Accordion sub-menus */
.m-sub {
  list-style: none;
  margin: 0;
  padding: 0;
  border-left: 2px solid #CE1126;
  margin-left: 20px;
  background: rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.32s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.m-sub > div {
  min-height: 0;
  overflow: hidden;
}
.m-sub.show {
  grid-template-rows: 1fr;
}
.m-sub ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.m-sub li a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
  font-size: 0.7rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  letter-spacing: 0.02em;
  text-transform: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s ease, color 0.2s ease, padding-left 0.2s ease;
}
.m-sub li:last-child a {
  border-bottom: none;
}
.m-sub li a:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding-left: 20px;
}
.m-nested {
  margin-left: 10px;
  border-left: 2px solid rgba(206, 17, 38, 0.5);
}

.m-arrow {
  font-size: 0.5rem;
  opacity: 0.6;
  display: inline-flex;
  align-items: center;
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
  color: #ffffff;
}
.m-arrow.rotated {
  transform: rotate(180deg);
  opacity: 1;
}

/* Sidebar footer */
.sidebar-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding: 14px 20px;
  display: flex;
  gap: 16px;
  background: rgba(255, 255, 255, 0.02);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}
.sidebar-footer a {
  font-size: 0.6rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  transition: color 0.2s ease, text-shadow 0.2s ease;
  letter-spacing: 0.02em;
}
.sidebar-footer a:hover {
  color: #ff334b;
  text-shadow: 0 0 8px rgba(255, 51, 75, 0.4);
}

/* ─── Sidebar Light Mode (Glass Style) ───────────────── */
.mobile-sidebar.light-mode {
  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(48px) saturate(220%) brightness(1.15);
  -webkit-backdrop-filter: blur(48px) saturate(220%) brightness(1.15);
  border-left-color: rgba(255, 255, 255, 0.6);
  box-shadow:
    -30px 0 80px rgba(0, 0, 0, 0.1),
    inset 1px 0 0 rgba(255, 255, 255, 0.8),
    inset -1px 0 0 rgba(255, 255, 255, 0.2);
}
.mobile-sidebar.light-mode .sidebar-header {
  border-bottom-color: rgba(7, 17, 94, 0.1);
  background: rgba(255, 255, 255, 0.1);
}
.mobile-sidebar.light-mode .sidebar-seal {
  border-color: rgba(7, 17, 94, 0.2);
  box-shadow: 0 0 12px rgba(7, 17, 94, 0.08);
}
.mobile-sidebar.light-mode .sidebar-title {
  color: #07115E;
  text-shadow: none;
}
.mobile-sidebar.light-mode .sidebar-subtitle {
  color: rgba(7, 17, 94, 0.6);
}
.mobile-sidebar.light-mode .sidebar-close {
  color: rgba(7, 17, 94, 0.7);
  border-color: rgba(7, 17, 94, 0.15);
  background: rgba(7, 17, 94, 0.05);
}
.mobile-sidebar.light-mode .sidebar-close:hover {
  background: rgba(7, 17, 94, 0.12);
  color: #07115E;
  border-color: rgba(7, 17, 94, 0.3);
  box-shadow: 0 0 10px rgba(7, 17, 94, 0.1);
}
.mobile-sidebar.light-mode .m-item {
  border-bottom-color: rgba(7, 17, 94, 0.08);
}
.mobile-sidebar.light-mode .m-link,
.mobile-sidebar.light-mode .m-item > a {
  color: rgba(7, 17, 94, 0.9);
  text-shadow: none;
}
.mobile-sidebar.light-mode .m-link:hover,
.mobile-sidebar.light-mode .m-item > a:hover {
  color: #07115E;
  background: rgba(7, 17, 94, 0.06);
  text-shadow: none;
}
.mobile-sidebar.light-mode .m-sub {
  background: rgba(7, 17, 94, 0.04);
}
.mobile-sidebar.light-mode .m-sub li a {
  color: rgba(7, 17, 94, 0.7);
  border-bottom-color: rgba(7, 17, 94, 0.06);
}
.mobile-sidebar.light-mode .m-sub li:last-child a {
  border-bottom: none;
}
.mobile-sidebar.light-mode .m-sub li a:hover {
  color: #07115E;
  background: rgba(7, 17, 94, 0.08);
}
.mobile-sidebar.light-mode .m-arrow {
  color: #07115E;
}
.mobile-sidebar.light-mode .sidebar-footer {
  border-top-color: rgba(7, 17, 94, 0.1);
  background: rgba(255, 255, 255, 0.1);
}
.mobile-sidebar.light-mode .sidebar-footer a {
  color: rgba(7, 17, 94, 0.5);
}
.mobile-sidebar.light-mode .sidebar-footer a:hover {
  color: #CE1126;
  text-shadow: none;
}
.mobile-sidebar.light-mode .sidebar-body::-webkit-scrollbar-thumb {
  background: rgba(7, 17, 94, 0.2);
}
.mobile-sidebar.light-mode .sidebar-body::-webkit-scrollbar-thumb:hover {
  background: rgba(7, 17, 94, 0.35);
}

/* ─── Site Header ─────────────────────────────────────── */
.site-header {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 500;
  height: 58px;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;

  background: rgba(7, 17, 94, 0.28);
  backdrop-filter: blur(20px) saturate(160%) brightness(0.7);
  -webkit-backdrop-filter: blur(20px) saturate(160%) brightness(0.7);

  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  font-family: 'Poppins', sans-serif;

  transition: opacity 0.3s ease, all 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease;
}

/* Shrink / Floating Effect (Desktop Default) */
.site-header.is-scrolled {
  top: 12px;
  width: calc(100% - 32px);
  max-width: 1100px;
  border-radius: 50px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Fade out the real header once the mobile sidebar (with its own header) covers it */
.site-header.menu-open {
  opacity: 0;
  pointer-events: none;
}

/* Header always uses dark glass — light-mode removed */

.header-inner {
  max-width: 1240px;
  width: 100%;
  height: 58px;
  margin: 0 auto;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  transition: padding 0.4s ease, gap 0.4s ease;
}

/* ─── Logo ────────────────────────────────────────────── */
.logo-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  cursor: pointer;
  text-decoration: none;
  transition: gap 0.4s ease;
}
.nav-seal {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: transparent;
  border: none;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s;
}
.logo-group:hover .nav-seal {
  opacity: 0.85;
}
.nav-seal-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
  display: block;
}
.logo-text {
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  max-width: 300px;
  opacity: 1;
  transition: max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}
.logo-text h1 {
  margin: 0;
  font-size: 0.75rem; font-weight: 600;
  color: #ffffff;
  text-transform: uppercase; letter-spacing: 0.08em;
  transition: color 0.4s ease;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.logo-text span {
  display: block;
  font-size: 0.56rem;
  color: rgba(255, 255, 255, 0.65);
  letter-spacing: 0.06em;
  margin-top: 1px;
  transition: color 0.4s ease;
}

/* ─── Desktop Navigation ──────────────────────────────── */
.main-nav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
}
.nav-links {
  display: flex;
  gap: 0;
  list-style: none;
}
.nav-links > li { position: relative; }
.nav-links > li > a {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 11px;
  font-size: 0.65rem; font-weight: 600;
  letter-spacing: 0.07em; text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none; white-space: nowrap;
  transition: color 0.4s ease;
  position: relative;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.nav-links > li > a::after {
  content: '';
  position: absolute; bottom: 2px;
  left: 11px; right: 11px;
  height: 1.5px; background: #CE1126;
  transform: scaleX(0);
  transition: transform 0.3s ease;
  transform-origin: left;
}
.nav-links > li > a:hover { color: #ffffff; }
.nav-links > li > a:hover::after { transform: scaleX(1); }

.arrow {
  font-size: 0.5rem; opacity: 0.45;
  display: inline-flex; align-items: center;
  transition: transform 0.25s ease, opacity 0.2s, color 0.4s ease;
  color: inherit;
}
.arrow.rotated { transform: rotate(180deg); opacity: 0.85; }
.sub-arrow.rotated { transform: rotate(90deg); opacity: 0.85; }

/* ─── Desktop Dropdowns (Glassmorphism) ───────────────── */
.dropdown {
  list-style: none;
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 220px;
  z-index: 600;
  border-radius: 14px;

  background: rgba(7, 17, 94, 0.45);
  backdrop-filter: blur(36px) saturate(200%);
  -webkit-backdrop-filter: blur(36px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-top: 2px solid #CE1126;
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);

  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px) scale(0.98);
  transition:
    opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    visibility 0.25s;
  pointer-events: none;
}
.dropdown.show {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
  pointer-events: all;
}

/* Invisible bridge so hover isn't lost while crossing the 8px gap */
.dropdown::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  height: 8px;
}

/* Rounded corners on edge items (replaces overflow:hidden clipping) */
.dropdown > li:first-child > a {
  border-radius: 13px 13px 0 0;
}
.dropdown > li:last-child > a {
  border-radius: 0 0 13px 13px;
}
.dropdown > li:only-child > a {
  border-radius: 13px;
}

.dropdown li { position: relative; }
.dropdown li a {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 18px;
  font-size: 0.72rem; font-weight: 400;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none; white-space: nowrap;
  letter-spacing: 0.03em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s ease, color 0.2s ease, padding-left 0.2s ease;
}
.dropdown li:last-child a { border-bottom: none; }
.dropdown li a:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  padding-left: 22px;
}

/* Dropdown always uses dark glass — light-mode removed */

.sub-dropdown {
  top: -2px;
  left: calc(100% + 6px);
  right: auto;
  border-top: 2px solid #CE1126;
}

/* Invisible bridge for the 6px horizontal gap of sub-dropdowns */
.sub-dropdown::before {
  top: 0;
  left: -6px;
  width: 6px;
  height: 100%;
}

.has-sub.flip-left > .sub-dropdown {
  left: auto;
  right: calc(100% + 6px);
}

.has-sub.flip-left > .sub-dropdown::before {
  left: auto;
  right: -6px;
  width: 6px;
}

/* Hover-open for desktop */
@media (hover: hover) and (pointer: fine) {
  .has-dropdown:hover > .dropdown,
  .has-sub:hover > .sub-dropdown {
    opacity: 1;
    visibility: visible;
    transform: translateY(0) scale(1);
    pointer-events: all;
  }
}

/* ─── Hamburger ───────────────────────────────────────── */
.mobile-menu-btn {
  display: none;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.25);
  width: 38px; height: 38px;
  border-radius: 8px;
  cursor: pointer; padding: 0;
  flex-direction: column;
  align-items: center; justify-content: center;
  gap: 5px;
  flex-shrink: 0;
  position: relative;
  transition: all 0.4s ease, background 0.2s, border-color 0.4s ease;
}
.mobile-menu-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.45);
}
.mobile-menu-btn span {
  display: block;
  width: 18px; height: 1.5px;
  background: #ffffff; border-radius: 1px;
  transition: transform 0.3s ease, opacity 0.3s ease, background 0.4s ease;
}
.mobile-menu-btn span:nth-child(1).active { transform: rotate(45deg) translate(4.5px, 4.5px); }
.mobile-menu-btn span:nth-child(2).active { opacity: 0; transform: scaleX(0); }
.mobile-menu-btn span:nth-child(3).active { transform: rotate(-45deg) translate(4.5px, -4.5px); }

/* ─── Responsive (Mobile & Tablet) ────────────────────── */
@media (max-width: 960px) {
  .main-nav { display: none; }
  .mobile-menu-btn { display: flex; }
  .header-inner { padding: 0 16px; }

  .site-header {
    width: 100%;
    max-width: 100%;
    top: 0;
    border-radius: 0;
  }

  .site-header.is-scrolled {
    width: 54px;
    height: 54px;
    max-width: 54px;
    right: 16px;
    left: auto;
    transform: none;
    top: 12px;
    border-radius: 50%;
    cursor: pointer;
  }

  .site-header.is-scrolled .header-inner {
    padding: 0;
    justify-content: center;
    align-items: center;
    height: 54px;
    width: 54px;
  }

  .site-header.is-scrolled .nav-seal {
    width: 44px;
    height: 44px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .site-header.is-scrolled .logo-text {
    max-width: 0;
    opacity: 0;
    display: none;
  }

  .site-header.is-scrolled .logo-group {
    gap: 0;
    margin: 0;
    width: 100%;
    justify-content: center;
  }

  .site-header.is-scrolled .mobile-menu-btn {
    width: 0;
    opacity: 0;
    border: none;
    pointer-events: none;
    padding: 0;
    margin: 0;
    display: none;
  }
}
</style>