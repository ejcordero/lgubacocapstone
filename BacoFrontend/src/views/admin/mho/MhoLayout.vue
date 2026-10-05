<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import MhoSidebar from './components/MhoSidebar.vue'
import MhoTopbar from './components/MhoTopbar.vue'
import { guard } from './composables/useMhoAdminAuth.js'
import './style/mho.css'

/*
 * MHO role console.
 *
 * Deliberately independent of the native admin: its own root class, its own
 * token vocabulary, its own sidebar, its own route tree. Nothing here imports
 * from ../components or ../style, so a change to the native admin cannot reach
 * this console and vice versa.
 *
 * The style sheet is imported here rather than in main.js so the module stays
 * self-contained — the same approach views/user/UserLayout.vue takes.
 */

const collapsed = ref(false)
const mobileOpen = ref(false)
const rootRef = ref(null)

/* Shares the admin's theme switch, and the same localStorage key, so flipping
   the mode in either console keeps the other in step. */
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
  // Mirror onto <html> as the admin layout does, so anything portalled to
  // body still reads the admin tokens.
  document.documentElement.setAttribute('data-admin-theme', theme.value)
})

defineExpose({ toggleTheme })
</script>

<template>
  <!-- Carries `.admin-layout` as well as `.mho-admin` so the native admin's
       material layer (material.css `--m-*` tokens, folio.css, the `mat-*`
       utilities) resolves for this console too. That is what makes the chrome
       below look like the admin rather than merely resemble it. `admin-layout`
       carries no rules of its own outside material.css — AdminLayout.vue's own
       CSS is scoped to its own template — so nothing leaks in from it. -->
  <div
    class="mho-admin admin-layout"
    :data-admin-theme="theme"
    ref="rootRef"
  >
    <MhoSidebar
      :collapsed="collapsed"
      :mobile-open="mobileOpen"
      @toggle-collapse="collapsed = !collapsed"
      @close-mobile="mobileOpen = false"
    />

    <div v-if="mobileOpen" class="mho-backdrop" @click="mobileOpen = false"></div>

    <div class="mho-admin__main">
      <MhoTopbar
        :key="route.name"
        :is-dark="theme === 'dark'"
        @toggle-sidebar="toggleSidebar"
        @toggle-theme="toggleTheme"
      />

      <main class="mho-admin__workspace">
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
.mho-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 190;
}
@media (min-width: 861px) {
  .mho-backdrop { display: none; }
}
</style>