<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import TourismSidebar from './components/TourismSidebar.vue'
import TourismTopbar from './components/TourismTopbar.vue'
import { guard } from './composables/useTourismAdminAuth.js'
import './style/tourism.css'

/*
 * Tourism role console.
 *
 * Deliberately independent of the native admin AND of the MHO console: its own
 * root class, its own token vocabulary, its own sidebar, its own route tree.
 * Nothing here imports from ../components, ../style or ../mho, so a change to
 * any of those cannot reach this console.
 *
 * The style sheet is imported here rather than in main.js so the module stays
 * self-contained — the same approach views/user/UserLayout.vue takes.
 */

const collapsed = ref(false)
const mobileOpen = ref(false)

/* Same mechanism, same localStorage key as MhoLayout.vue, so the two consoles
   stay in step and the mode set here is already set when the user lands on
   /mho-admin. */
const theme = ref(localStorage.getItem('admin_theme') === 'light' ? 'light' : 'dark')

const route = useRoute()

const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('admin_theme', theme.value)
}

const toggleSidebar = () => {
  if (window.matchMedia('(max-width: 860px)').matches) {
    mobileOpen.value = !mobileOpen.value
  } else {
    collapsed.value = !collapsed.value
  }
}

onMounted(() => {
  // The router guard already ran before this mounted; this is a second
  // checkpoint so a cached component cannot sit on screen after sign-out.
  if (!guard()) return
  document.documentElement.setAttribute('data-admin-theme', theme.value)
})
</script>

<template>
  <!-- Carries `.admin-layout` as well as `.tourism-admin`, exactly as
       MhoLayout.vue does, so material.css's `--m-*` tokens resolve and the
       console renders through the same material layer. Without this the
       `--m-glass` / `--m-skeuo-*` aliases in tourism.css resolve to nothing. -->
  <div
    class="tourism-admin admin-layout"
    :data-admin-theme="theme"
  >
    <TourismSidebar
      :collapsed="collapsed"
      :mobile-open="mobileOpen"
      @toggle-collapse="collapsed = !collapsed"
      @close-mobile="mobileOpen = false"
    />

    <div v-if="mobileOpen" class="tr-backdrop" @click="mobileOpen = false"></div>

    <div class="tourism-admin__main">
      <TourismTopbar
        :key="route.name"
        :is-dark="theme === 'dark'"
        @toggle-sidebar="toggleSidebar"
        @toggle-theme="toggleTheme"
      />

      <main class="tourism-admin__workspace">
        <router-view v-slot="{ Component }">
          <!-- Keyed on the route name so switching pages resets each page's
               local state and scroll position instead of carrying it over. -->
          <component :is="Component" :key="route.name" />
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.tr-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 190;
}
@media (min-width: 861px) {
  .tr-backdrop { display: none; }
}
</style>