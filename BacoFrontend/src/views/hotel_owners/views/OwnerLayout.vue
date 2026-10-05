<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import OwnerSidebar from '../components/OwnerSidebar.vue'
import OwnerHeader from '../components/OwnerHeader.vue'
import OwnerMobileNav from '../components/OwnerMobileNav.vue'

const sidebarOpen = ref(false)
const owner = ref(null)
const route = useRoute()

onMounted(() => {
  const data = localStorage.getItem('ownerData')
  if (data) owner.value = JSON.parse(data)
  document.body.classList.add('baco-owner')
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.body.classList.remove('baco-owner')
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

// Escape closes the drawer. Without it the only exits were the overlay and the
// nav items themselves.
function onKeydown(e) {
  if (e.key === 'Escape' && sidebarOpen.value) sidebarOpen.value = false
}

// A route change must always drop the drawer, or it stays open over the page
// the user just navigated to. Desktop is unaffected — the sidebar is docked.
watch(() => route.fullPath, () => { sidebarOpen.value = false })

// Stop the page behind the drawer from scrolling under the user's thumb. Only
// matters below 1024px, where the drawer exists at all.
watch(sidebarOpen, (open) => {
  if (window.matchMedia('(max-width: 1024px)').matches) {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value
}
</script>

<template>
  <!-- The class "owner-layout-bg" controls the global background and text color -->
  <div class="owner-layout-bg" :class="{ 'sidebar-open': sidebarOpen }">
    <div class="overlay" v-if="sidebarOpen" @click="toggleSidebar"></div>
    <OwnerSidebar :open="sidebarOpen" @close="toggleSidebar" />
    <OwnerMobileNav />
    <div class="main-content">
      <OwnerHeader
        @toggle-sidebar="toggleSidebar"
        :owner="owner"
        :open="sidebarOpen"
      />
      <main class="page-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* OwnerLayout adds .baco-owner to <body>, but nothing ever styled it. The
   global reset in src/style.css is `body { display: flex; place-items: center }`,
   intended for the public pages' centred layout. It leaves the owner layout as a
   centred flex child, and a centred flex child wider than the viewport is
   clipped on BOTH sides with no way to scroll to the overflow — on a phone that
   hid the left part of the off-canvas drawer and could trap wide content. */
:global(body.baco-owner) {
  display: block;
  place-items: initial;
  min-width: 0;
}

/* ✅ THIS IS THE FIX: Using CSS variables for the root background and text */
.owner-layout-bg {
  display: flex;
  min-height: 100vh;
  height: 100vh;
  background-color: var(--bg); 
  color: var(--fg); 
  transition: background-color 0.3s ease, color 0.3s ease;
  width: 100%;
  overflow: hidden;
}

.main-content {
  flex: 1;
  margin-left: 260px;
  transition: margin-left .4s cubic-bezier(.22,1,.36,1);
  min-width: 0;
  width: 100%;
  height: 100vh;
  overflow-y: auto;
}

.page-content {
  padding: 28px;
  min-height: calc(100vh - 70px);
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}

.overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.7);
  z-index: 900;
}

@media (max-width: 1024px) {
  .main-content { margin-left: 0; }
  .overlay { display: block; }

  /* Tighter gutters on phones — 28px each side left too little room for a
     200px stat card and forced the grids to scroll sideways. */
  .page-content { padding: 18px 16px; }

  /* OwnerSidebar's .mobile-bottom-nav is position:fixed at the bottom, 65px
     tall plus the device safe-area inset. Nothing reserved space for it, so the
     last row of every page sat underneath it. */
  .page-content {
    padding-bottom: calc(65px + env(safe-area-inset-bottom, 0px) + 20px);
  }
}

/* Below 400px even 16px gutters squeeze the stat cards. */
@media (max-width: 400px) {
  .page-content { padding-left: 12px; padding-right: 12px; }
}
</style>