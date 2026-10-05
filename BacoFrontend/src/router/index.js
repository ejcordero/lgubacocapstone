import { createRouter, createWebHistory } from 'vue-router'

// Public routes
import Home            from '../views/Home.vue'
import Tourism         from '../views/Tourism.vue'
import TALA            from '../views/TALA.vue'
import Barangays       from '../views/Barangays.vue'
import History         from '../views/History.vue'
import Officials       from '../views/Officials.vue'
import News            from '../views/News.vue'
import Municipality    from '../views/Municipality.vue'
import BPLO            from '../views/BPLO.vue'
import MHO             from '../views/MHO.vue'
import CitizensCharter from '../views/CitizensCharter.vue'
import HalconBooking   from '../views/HalconBooking.vue'
import TourismBooking  from '../views/TourismBooking.vue'
import Schools from '../views/Schools.vue'
import AllOffices     from '../views/AllOffices.vue'

// Shared informational views — Privacy Policy, Disclaimer, Accessibility
// render through InfoPage.vue (content lives on route meta); the Sitemap
// builds itself from the router's own route table.
// ⚠️ Both files must exist: src/views/InfoPage.vue and src/views/Sitemap.vue
import InfoPage from '../views/InfoPage.vue'
import Sitemap  from '../views/Sitemap.vue'

// (AuthView removed — it was imported but never used in any route)

// Admin routes
import AdminLogin      from '../views/admin/AdminLogin.vue'
import AdminLayout     from '../views/admin/AdminLayout.vue'
import AdminDashboard  from '../views/admin/AdminDashboard.vue'
import AdminHotel      from '../views/admin/components/AdminHotel.vue'
import ResortsManager  from '../views/admin/components/ResortsManager.vue'
import MHOAdmin        from '../views/admin/components/MHOAdmin.vue'

// Role-based consoles (independent of the native admin above)
import MhoLayout         from '../views/admin/mho/MhoLayout.vue'
import MhoOverview       from '../views/admin/mho/views/MhoOverview.vue'
import MhoServices       from '../views/admin/mho/views/MhoServices.vue'
import MhoPageContent    from '../views/admin/mho/views/MhoPageContent.vue'
import MhoAnnouncement   from '../views/admin/mho/views/MhoAnnouncement.vue'
import TourismLayout     from '../views/admin/tourism/TourismLayout.vue'
import TourismOverview   from '../views/admin/tourism/views/TourismOverview.vue'
import TourismDestinations from '../views/admin/tourism/views/TourismDestinations.vue'
import TourismArrivals   from '../views/admin/tourism/views/TourismArrivals.vue'

// User routes
import UserLayout         from '../views/user/UserLayout.vue'
import UserDashboard      from '../views/user/UserDashboard.vue'
import HotelBrowse        from '../views/user/HotelBrowse.vue'
import HotelDetail        from '../views/user/HotelDetail.vue'
import HotelConfirmation  from '../views/user/HotelConfirmation.vue'
import HalconList         from '../views/user/HalconList.vue'
import HalconApply        from '../views/user/HalconApply.vue'
import HalconTracker      from '../views/user/HalconTracker.vue'
import TrailMap           from '../views/user/TrailMap.vue'
import UserProfile        from '../views/user/UserProfile.vue'
import UserAuth           from '../views/user/UserAuth.vue'
import UserBookings      from '../views/user/UserBookings.vue'
import UserReviews       from '../views/user/UserReviews.vue'

// Hotel Owner routes
import OwnerLogin        from '../views/hotel_owners/views/OwnerLogin.vue'
import OwnerRegister     from '../views/hotel_owners/views/OwnerRegister.vue'
import OwnerLayout       from '../views/hotel_owners/views/OwnerLayout.vue'
import DashboardOverview from '../views/hotel_owners/views/DashboardOverview.vue'
import HotelManager      from '../views/hotel_owners/views/HotelManager.vue'
import RoomManager       from '../views/hotel_owners/views/RoomManager.vue'
import EntranceFeeManager from '../views/hotel_owners/views/EntranceFeeManager.vue'
import Reviews          from '../views/hotel_owners/views/Reviews.vue'
import BookingManager    from '../views/hotel_owners/views/BookingManager.vue'
import GuestDirectory    from '../views/hotel_owners/views/GuestDirectory.vue'
import RevenueAnalytics  from '../views/hotel_owners/views/RevenueAnalytics.vue'
import InvoiceManager    from '../views/hotel_owners/views/InvoiceManager.vue'
import OwnerProfile      from '../views/hotel_owners/views/OwnerProfile.vue'
import OwnerVerification from '../views/hotel_owners/views/OwnerVerification.vue'
import OwnerSetting      from '../views/hotel_owners/views/OwnerSetting.vue'

// ═══════════════════════════════════════════════════════════
// ROLE-BASED CONSOLES
// ───────────────────────────────────────────────────────────
// Separate route roots, NOT children of /admin, for two reasons:
//   1. /admin's AdminLayout switches panels from an internal `mode` ref and
//      renders no <router-view>, so a child route there cannot mount anyway.
//   2. /admin/mho is already claimed by the existing `admin-mho` child entry.
// Rooting these at /mho-admin and /tourism-admin sidesteps both without
// touching the native admin's route table.
//
// Each console ships its own layout, sidebar, components and style folder, and
// shares only the sign-in screen at /admin/login.
// ═══════════════════════════════════════════════════════════

// Reads the session the shared login writes. Kept inline rather than imported
// from a module's composable so this file stays the single place routing and
// access control are visible together.
//
// Redirects by PATH, not by name: the '/admin/login' entry above carries no
// `name`, so resolving { name: 'admin-login' } would throw on every rejection.
// Naming that route would be an edit to the native admin's table for no gain.
const ADMIN_LOGIN_PATH = '/admin/login'

const adminRoleGuard = (allowed) => () => {
  const token = localStorage.getItem('baco_admin_token')
  const role  = localStorage.getItem('baco_admin_role')
  if (!token) return ADMIN_LOGIN_PATH

  if (!allowed.includes(role)) {
    // The session MUST be dropped here. AdminLogin.vue redirects any surviving
    // token to '/admin', so bouncing to the login page while leaving these keys
    // in place would hand the rejected user straight back to the dashboard
    // instead of showing the form.
    localStorage.removeItem('baco_admin_token')
    localStorage.removeItem('baco_admin_role')
    localStorage.removeItem('baco_admin_data')
    return ADMIN_LOGIN_PATH
  }

  return true
}

const routes = [
  // ─── Public ───────────────────────────────────────────────────
  // Every route gets a `name` so RouterLinks can target names instead of raw
  // paths, and `meta.public` so the Sitemap view can discover them.
  { path: '/',                 name: 'home',             component: Home,            meta: { public: true } },
  { path: '/tourism',          name: 'tourism',          component: Tourism,         meta: { public: true } },
  { path: '/tala',             name: 'tala',             component: TALA,            meta: { public: true, title: 'TALA' } },
  { path: '/barangays',        name: 'barangays',        component: Barangays,       meta: { public: true } },
  { path: '/history',          name: 'history',          component: History,         meta: { public: true } },
  { path: '/officials',        name: 'officials',        component: Officials,       meta: { public: true } },
  { path: '/news',             name: 'news',             component: News,            meta: { public: true, title: 'News & Updates' } },
  { path: '/municipality',     name: 'municipality',     component: Municipality,    meta: { public: true, title: 'About the Municipality' } },
  { path: '/bplo',             name: 'bplo',             component: BPLO,            meta: { public: true, title: 'BPLO' } },
  { path: '/mho',              name: 'mho',              component: MHO,             meta: { public: true, title: 'Municipal Health Office' } },
  { path: '/citizens-charter', name: 'citizens-charter', component: CitizensCharter, meta: { public: true } },
  { path: '/halcon-booking',   name: 'halcon-booking',   component: HalconBooking,   meta: { public: true } },
  { path: '/tourism-booking',  name: 'tourism-booking',  component: TourismBooking,  meta: { public: true } },
  { path: '/schools',          name: 'schools',          component: Schools,         meta: { public: true } },
  { path: '/alloffices',       name: 'all-offices',      component: AllOffices,      meta: { public: true } },

  // ─── Public Authentication ────────────────────────────────────
  { path: '/auth', name: 'auth', component: UserAuth },

  // ─── Legal / informational pages ──────────────────────────────
  // One shared view (InfoPage.vue) renders all three; the content lives on
  // route meta, so adding a future policy page = one route, zero new views.
  {
    path: '/privacy-policy', name: 'privacy-policy', component: InfoPage,
    meta: {
      public: true,
      infoPage: {
        title: 'Privacy Policy',
        updated: 'January 2026',
        sections: [
          {
            heading: 'Commitment to Privacy',
            paragraphs: ['The Municipal Government of Baco respects the privacy of every visitor to this website and is committed to protecting personal information in accordance with Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012.'],
          },
          {
            heading: 'Information We Collect',
            list: [
              'Name, email address and contact number you provide when creating an account',
              'Documents and details submitted through permit applications and service requests',
              'Booking and reservation details for hotels and tourism services',
              'Standard technical logs such as IP address, browser type and pages visited',
            ],
          },
          {
            heading: 'How We Use Your Information',
            paragraphs: ['Information collected through this website is used solely to deliver the services you request, to respond to inquiries, and to improve the quality of this website. The Municipality does not sell or share personal information with third parties except when required by law or when necessary to complete a service you have requested.'],
          },
          {
            heading: 'Your Rights',
            paragraphs: ['Under the Data Privacy Act, you have the right to access, correct, and request the deletion of your personal data. For privacy-related concerns, contact the Municipal Data Protection Officer at info@baco.gov.ph.'],
          },
        ],
      },
    },
  },
  {
    path: '/disclaimer', name: 'disclaimer', component: InfoPage,
    meta: {
      public: true,
      infoPage: {
        title: 'Disclaimer',
        updated: 'January 2026',
        sections: [
          {
            heading: 'General Information',
            paragraphs: ['All information published on this website is provided for general public information only. While the Municipality of Baco makes every effort to keep the content accurate and up to date, no representation or warranty, express or implied, is made as to its completeness or accuracy.'],
          },
          {
            heading: 'No Legal Advice',
            paragraphs: ['Nothing on this website constitutes legal advice. For official certifications, permits and other legal matters, please transact directly with the concerned municipal office.'],
          },
          {
            heading: 'External Links',
            paragraphs: ['This website may contain links to third-party websites. The Municipal Government of Baco is not responsible for the content, accuracy or availability of any external site.'],
          },
        ],
      },
    },
  },
  {
    path: '/accessibility', name: 'accessibility', component: InfoPage,
    meta: {
      public: true,
      infoPage: {
        title: 'Accessibility',
        updated: 'January 2026',
        sections: [
          {
            heading: 'Our Commitment',
            paragraphs: ['The Municipal Government of Baco is committed to making its website accessible to all users, including persons with disabilities, in line with Batas Pambansa Blg. 344 (the Accessibility Law) and internationally recognised web accessibility standards.'],
          },
          {
            heading: 'Accessibility Features',
            list: [
              'Keyboard-navigable menus and forms',
              'Text alternatives for meaningful images',
              'Sufficient colour contrast across the site',
              'Responsive layout for mobile devices',
            ],
          },
          {
            heading: 'Feedback',
            paragraphs: ['If you encounter any barrier while using this website, please report it to info@baco.gov.ph or call +63 912 345 6789 so we can address it.'],
          },
        ],
      },
    },
  },
  {
    path: '/sitemap', name: 'sitemap', component: Sitemap,
    meta: { public: true },
  },

  // ─── Admin ────────────────────────────────────────────────────
  { path: '/admin/login', component: AdminLogin },
  {
    path: '/admin',
    component: AdminLayout,
    children: [
      { path: '',          redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'admin-dashboard', component: AdminDashboard },
      { path: 'hotels',    name: 'admin-hotels',    component: AdminHotel },      // LGU-owned listings only
      { path: 'resorts',   name: 'admin-resorts',   component: ResortsManager },  // Owner resort review/publish
      { path: 'mho',       name: 'admin-mho',       component: MHOAdmin },
    ]
  },

  // ─── MHO Role Console ───────────────────────────────────────
  {
    path: '/mho-admin',
    component: MhoLayout,
    beforeEnter: adminRoleGuard(['mho_admin', 'main_controller']),
    children: [
      { path: '',            redirect: { name: 'mho-admin-dashboard' } },
      { path: 'dashboard',   name: 'mho-admin-dashboard',    component: MhoOverview },
      { path: 'services',    name: 'mho-admin-services',    component: MhoServices },
      { path: 'content',     name: 'mho-admin-content',     component: MhoPageContent },
      { path: 'announcement',name: 'mho-admin-announcement',component: MhoAnnouncement }
    ]
  },

  // ─── Tourism Role Console ───────────────────────────────────
  {
    path: '/tourism-admin',
    component: TourismLayout,
    beforeEnter: adminRoleGuard(['tourism_admin', 'main_controller']),
    children: [
      { path: '',            redirect: { name: 'tourism-admin-dashboard' } },
      { path: 'dashboard',   name: 'tourism-admin-dashboard',    component: TourismOverview },
      { path: 'destinations',name: 'tourism-admin-destinations', component: TourismDestinations },
      { path: 'arrivals',    name: 'tourism-admin-arrivals',     component: TourismArrivals }
    ]
  },

  // ─── User portal ──────────────────────────────────────────────
  {
    path: '/user',
    component: UserLayout,
    children: [
      { path: '', redirect: { name: 'user-dashboard' } },

      { path: 'dashboard', name: 'user-dashboard', component: UserDashboard },

      // ⚠️ Static routes MUST come before :id params
      { path: 'hotels',              name: 'hotel-browse',       component: HotelBrowse },
      { path: 'hotels/confirmation', name: 'hotel-confirmation', component: HotelConfirmation },
      { path: 'hotels/:id',          name: 'hotel-detail',       component: HotelDetail },

      { path: 'bookings', name: 'user-bookings', component: UserBookings },
      { path: 'reviews',  name: 'user-reviews',  component: UserReviews },

      // ⚠️ Static 'apply' MUST come before :id
      { path: 'permits',          name: 'halcon-list',    component: HalconList },
      { path: 'permits/apply',    name: 'halcon-apply',   component: HalconApply },
      { path: 'permits/:id',      name: 'halcon-tracker', component: HalconTracker, props: true },
      { path: 'permits/:id/edit', name: 'halcon-edit',    component: HalconApply, props: true },

      { path: 'map',     name: 'trail-map',    component: TrailMap },
      { path: 'profile', name: 'user-profile', component: UserProfile },
    ]
  },

  // ─── Hotel Owner Portal ───────────────────────────────────────
  { path: '/owner/login',    name: 'owner-login',    component: OwnerLogin },
  { path: '/owner/register', name: 'owner-register', component: OwnerRegister },
  {
    path: '/owner',
    component: OwnerLayout,
    beforeEnter: (to, from, next) => {
      // Accepts 'baco_owner_token' (real login) and 'ownerToken' (legacy mock)
      const token = localStorage.getItem('baco_owner_token') || localStorage.getItem('ownerToken')
      if (token) {
        next()
      } else {
        next({ name: 'owner-login' })
      }
    },
    children: [
      { path: '',               name: 'owner-dashboard',     component: DashboardOverview },
      { path: 'hotels',         name: 'owner-hotels',        component: HotelManager },
      { path: 'rooms',          name: 'owner-rooms',         component: RoomManager },
      { path: 'entrance-fees',  name: 'owner-entrance-fees', component: EntranceFeeManager },
      // NOTE: path 'oreviews' looks like a typo for 'reviews'. Left unchanged so
      // existing links keep working — if you rename it, update any sidebar link
      // that points at '/owner/oreviews'.
      { path: 'oreviews',       name: 'owner-reviews',       component: Reviews },
      { path: 'bookings',       name: 'owner-bookings',      component: BookingManager },
      { path: 'guests',         name: 'owner-guests',        component: GuestDirectory },
      { path: 'revenue',        name: 'owner-revenue',       component: RevenueAnalytics },
      { path: 'invoices',       name: 'owner-invoices',      component: InvoiceManager },
      { path: 'profile',        name: 'owner-profile',       component: OwnerProfile },
      { path: 'verification',   name: 'owner-verification',  component: OwnerVerification },
      { path: 'settings',       name: 'owner-settings',      component: OwnerSetting },
    ]
  },

  // ─── Fallback ─────────────────────────────────────────────────
  { path: '/:pathMatch(.*)*', redirect: { name: 'home' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

export default router