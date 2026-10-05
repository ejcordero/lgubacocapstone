<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme'


const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

const route = useRoute()
const router = useRouter()
const { isDarkMode, toggleTheme } = useTheme()

// ── Dynamic owner identity (replaces hardcoded "Marco Rivera") ──
const ownerData = ref(null)
onMounted(() => {
  try { ownerData.value = JSON.parse(localStorage.getItem('baco_owner_data') || 'null') } catch (e) { ownerData.value = null }
})
const ownerInitials = computed(() => {
  const d = ownerData.value
  if (!d) return 'OW'
  return `${(d.firstName || d.businessName || '?').charAt(0)}${(d.lastName || d.businessName || '').charAt(0)}`.toUpperCase()
})
const ownerDisplayName = computed(() => {
  const d = ownerData.value
  if (!d) return 'Resort Owner'
  return d.businessName || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Resort Owner'
})

// Full menu for Desktop Sidebar —
// ✅ fake badges ('3', '12') removed; new Entrance Fees + Inquiries pages added
const navItems = [
  { section: 'Main', items: [
    { path: '/owner',                icon: 'fa-th-large',       label: 'Dashboard',     exact: true },
    { path: '/owner/hotels',         icon: 'fa-building',       label: 'My Resort' },
    { path: '/owner/rooms',          icon: 'fa-door-open',      label: 'Room Types' },
    { path: '/owner/bookings',       icon: 'fa-calendar-check', label: 'Bookings' },
    { path: '/owner/oreviews',      icon: 'fa-comment-dots',   label: 'Reviews' },
    { path: '/owner/guests',         icon: 'fa-users',          label: 'Guests' },
  ]},
  { section: 'Finance', items: [
    { path: '/owner/revenue',  icon: 'fa-chart-line',          label: 'Revenue' },
    { path: '/owner/invoices', icon: 'fa-file-invoice-dollar', label: 'Invoices' },
  ]},
  { section: 'Account', items: [
    { path: '/owner/profile',       icon: 'fa-user-circle',   label: 'Profile' },
    { path: '/owner/verification',  icon: 'fa-shield-halved', label: 'Verification' },
    { path: '/owner/settings',      icon: 'fa-cog',           label: 'Settings' },
  ]}
]

const isActive = (item) => item.exact ? route.path === item.path : route.path.startsWith(item.path)
const navigate = (path) => { router.push(path); emit('close') }

// ✅ Working logout (was a dead button before)
const logout = () => {
  localStorage.removeItem('baco_owner_token')
  localStorage.removeItem('baco_owner_data')
  localStorage.removeItem('ownerToken') // legacy mock key
  router.push('/owner/login')
}
</script>

<template>
  <!-- ═══════════════════════════════════════════════════════ -->
  <!-- DESKTOP SIDEBAR (Hidden on Mobile)                      -->
  <!-- ═══════════════════════════════════════════════════════ -->
  <aside class="desktop-sidebar" :class="{ 'is-open': open }" id="owner-sidebar">
    <div class="sb-l">
      <div class="sb-i"><img src="/images/BACO-TOURISM.png" alt="Baco Tourism" /></div>
    </div>

    <nav class="sb-n">
      <div v-for="(section, si) in navItems" :key="si">
        <div class="nl">{{ section.section }}</div>
        <div v-for="(item, i) in section.items" :key="i" class="ni" :class="{ act: isActive(item) }" @click="navigate(item.path)">
          <i :class="'fas ' + item.icon"></i>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </nav>

    <div class="tt-r" @click="toggleTheme">
      <div class="tt-t" :class="{ on: isDarkMode }">
        <div class="tt-k"><i :class="isDarkMode ? 'fas fa-moon' : 'fas fa-sun'"></i></div>
      </div>
      <span class="tt-l">{{ isDarkMode ? 'Dark Mode' : 'Light Mode' }}</span>
    </div>

    <div class="sb-f">
      <div class="av">{{ ownerInitials }}</div>
      <div class="inf"><div class="nm">{{ ownerDisplayName }}</div><div class="rl">Resort Owner</div></div>
      <button class="hb" title="Logout" @click="logout"><i class="fas fa-sign-out-alt"></i></button>
    </div>
  </aside>

</template>

<style scoped>
/* ── DESKTOP SIDEBAR ── */
.desktop-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 260px;
  background: var(--bg2);
  border-right: 1px solid var(--bdr);
  z-index: 50;
  display: flex;
  flex-direction: column;
  transition: transform .4s cubic-bezier(.22,1,.36,1), background-color .3s, border-color .3s;
}

/* The logo is the only child now, so the row centres it instead of
   left-aligning it against the rail's padding. */
.sb-l { padding: 20px; border-bottom: 1px solid var(--bdr); display: flex; align-items: center; justify-content: center; transition: border-color .3s; }
/* BACO-TOURISM.png is a wide lockup (642x283, content ~3.24:1), so the plate
   widens to the artwork's aspect instead of forcing it into a 42px square. */
.sb-i { width: 150px; height: auto; background: none; border: 0; padding: 0; display: block; flex-shrink: 0; }
.sb-i img { width: 100%; height: auto; object-fit: contain; display: block; }
.nm { font-family: 'Unbounded', sans-serif; font-weight: 800; font-size: 18px; color: var(--fg); letter-spacing: -0.03em; line-height: 1; transition: color .3s; }
.sub { font-size: 9px; color: var(--mt); font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px; transition: color .3s; }
.sb-n { flex: 1; padding: 12px; overflow-y: auto; }
.sb-n::-webkit-scrollbar { width: 5px; }
.sb-n::-webkit-scrollbar-thumb { background: var(--bdr2); border-radius: 3px; }
.nl { font-family: 'Unbounded', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: var(--mt); padding: 16px 12px 8px; transition: color .3s; }
.ni { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; cursor: pointer; color: var(--fg2); font-size: 13.5px; font-weight: 500; transition: all .25s; position: relative; overflow: hidden; margin-bottom: 2px; background: transparent; border: none; width: 100%; text-align: left; font-family: 'Inter', sans-serif; }
.ni::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 0; background: var(--ac); border-radius: 0 3px 3px 0; transition: height .3s; }
.ni:hover { background: var(--acs); color: var(--fg); }
.ni:hover::before { height: 60%; }
.ni.act { background: var(--acs); color: var(--ac); font-weight: 600; }
.ni.act::before { height: 60%; }
.ni i { width: 20px; text-align: center; font-size: 14px; }
.tt-r { display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-top: 1px solid var(--bdr); cursor: pointer; transition: all .3s; }
.tt-r:hover { background: var(--acs); }
.tt-t { width: 42px; height: 24px; border-radius: 12px; background: var(--bdr); position: relative; flex-shrink: 0; transition: background .3s; }
.tt-t.on { background: var(--ac); }
.tt-k { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #050507; transition: transform .3s cubic-bezier(.22,1,.36,1); }
.tt-t.on .tt-k { transform: translateX(18px); }
.tt-l { font-size: 12px; font-weight: 600; color: var(--fg2); transition: color .3s; }
.sb-f { padding: 14px; border-top: 1px solid var(--bdr); display: flex; align-items: center; gap: 10px; transition: border-color .3s; }
.av { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, var(--ac), var(--wn)); display: flex; align-items: center; justify-content: center; font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 13px; color: #fff; flex-shrink: 0; }
.inf { flex: 1; min-width: 0; }
.inf .nm { font-size: 13px; font-weight: 600; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .3s; }
.inf .rl { font-size: 10px; color: var(--mt); font-weight: 500; transition: color .3s; }
.hb { width: 30px; height: 30px; border-radius: 8px; background: var(--card); border: 1px solid var(--bdr); color: var(--fg2); font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .25s; }
.hb:hover { background: var(--dgg, rgba(198,40,40,.1)); border-color: var(--dg, #C70505); color: var(--dg, #C70505); }

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  /* Off-canvas drawer, NOT display:none. It used to be display:none here,
     which deleted the sidebar outright — combined with the missing hamburger
     that left 8 of 11 owner pages (Room Types, Reviews, Guests, Revenue,
     Invoices, Profile, Verification, Settings) with no mobile route at all.
     Now it slides in from the left and OwnerLayout's overlay covers the page. */
  .desktop-sidebar {
    transform: translateX(-100%);
    box-shadow: none;
    width: min(280px, 85vw);
    /* Above the bottom nav (z-index 100), otherwise the nav draws over the
       drawer and the lower nav items stay tappable while the drawer is open. */
    z-index: 1000;
  }
  .desktop-sidebar.is-open {
    transform: translateX(0);
    box-shadow: 8px 0 32px rgba(0,0,0,.4);
  }
}
</style>