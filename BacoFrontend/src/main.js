import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './styles/theme.css'  // ← ADD THIS
import './styles/design-tokens-user.css'
import './styles/dashboard-vocabulary.css'
import './styles/tailwind.css'
import './views/admin/style/material.css'
import './views/admin/style/folio.css'
// after folio.css on purpose: the sign-in screen keeps its own ambient
// treatment and its own layout, and this ordering is what makes that hold
import './views/admin/style/login.css'
// The two public-facing sign-in screens follow the same pattern as the admin
// one: their own stylesheet, in the feature's own style/ folder, with every
// rule namespaced under a root class unique to that page (.ua-root, .ol-root).
// They declare their own tokens rather than borrowing from the sheets above, so
// a change to those cannot move a sign-in screen. Do not merge these into a
// shared file, and do not drop the prefixes — .login-page and .auth-container
// are both used by other views.
import './views/user/style/userAuth.css'
import './views/hotel_owners/style/ownerLogin.css'
import App from './App.vue'
import router from './router'
import 'leaflet/dist/leaflet.css'
import 'chart.js/auto'

// Import Font Awesome core and icons
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faChartPie, faPenNib, faNewspaper, faFileInvoiceDollar,
  faFileSignature, faUmbrellaBeach, faHeartPulse, faUsers,
  faBolt, faRightFromBracket, faIndent, faOutdent,
  faSpinner, faCheckCircle, faInfoCircle, faTriangleExclamation,
  faSearch, faDownload, faArrowRightToBracket,
  faSun, faMoon  // ← ADD THESE for toggle icons
} from '@fortawesome/free-solid-svg-icons'

library.add(
  faChartPie, faPenNib, faNewspaper, faFileInvoiceDollar,
  faFileSignature, faUmbrellaBeach, faHeartPulse, faUsers,
  faBolt, faRightFromBracket, faIndent, faOutdent,
  faSpinner, faCheckCircle, faInfoCircle, faTriangleExclamation,
  faSearch, faDownload, faArrowRightToBracket,
  faSun, faMoon  // ← ADD THESE
)

// ═══════════════════════════════════════════════════════════
// THEME INITIALIZER — runs BEFORE app mounts
// ═══════════════════════════════════════════════════════════
function initTheme() {
  const stored = localStorage.getItem('baco_theme') || localStorage.getItem('owner-theme')
  if (stored) {
    // User has a saved preference
    document.documentElement.setAttribute('data-theme', stored)
  } else {
    // Use OS preference as default
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  }
}
initTheme()

// Listen for OS theme changes (auto-update if user hasn't picked manually)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('baco_theme') && !localStorage.getItem('owner-theme')) {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
  }
})
// ═══════════════════════════════════════════════════════════

const app = createApp(App)

app.component('font-awesome-icon', FontAwesomeIcon)
app.use(createPinia())
app.use(router)

app.mount('#app')