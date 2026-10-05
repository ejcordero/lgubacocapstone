<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Header from './components/layout/Header.vue'
import Footer from './components/layout/Footer.vue'
import ChatWidget from './components/layout/ChatWidget.vue'

const route = useRoute()

// Hide Header, Footer, and ChatWidget on Admin, User, Auth, Owner, and the
// role-based consoles. The consoles are separate route roots, so they must be
// listed explicitly — '/mho-admin' does NOT start with '/admin', so without
// these two the public chrome renders on top of the admin shell.
const isPublicPage = computed(() =>
  !route.path.startsWith('/admin') &&
  !route.path.startsWith('/mho-admin') &&
  !route.path.startsWith('/tourism-admin') &&
  !route.path.startsWith('/user') &&
  !route.path.startsWith('/auth') &&
  !route.path.startsWith('/owner')
)
</script>

<template>
  <Header v-if="isPublicPage" />
  
  <RouterView />
  
  <Footer v-if="isPublicPage" />
  <ChatWidget v-if="isPublicPage" />
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700;900&family=Unbounded:wght@400;500;600;700;800;900&display=swap');

/* ── Design tokens — available site-wide ── */
:root {
  --navy:       #0B198F;
  --navy-deep:  #070f5c;
  --navy-light: #e8ecf8;
  --navy-mist:  #f0f3fb;
  --red:        #CE1126;
  --red-light:  #faeaec;
  --red-mist:   #fdf4f5;
  --white:      #ffffff;
  --ivory:      #f9f7f3;
  --ivory-mid:  #f2ede6;
  --ivory-dark: #e8e1d6;
  --ink:        #0f1423;
  --ink-mid:    #2d3650;
  --ink-soft:   #5a6480;
  --ink-faint:  #9aa0b8;
  --rule:       #dde1ee;
}

:global(html),
:global(body) {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
  background-color: #FFFFFF;
  color: #1F2937;
}

:global(html) {
  font-size: 16px;
}

:global(body) {
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:global(h1), :global(h2), :global(h3), :global(h4), :global(h5), :global(h6) {
  font-family: 'Merriweather', Georgia, serif;
  color: #0A3161;
}

/* ========================================== */
/* Hotel Owner Portal Theme Variables         */
/* ========================================== */

/* ── Hotel Owner Portal Theme Variables (Dark Mode Default) ── */
:root, [data-theme="dark"] {
  --bg: #050507;
  --bg2: #0D0D12;
  --bg3: #16161D;
  --card: #111118;
  --card2: #18181F;
  --card3: #1E1E28;
  --bdr: #25252E;
  --bdr2: #35353F;
  --bdr3: #45454F;
  --fg: #FFFFFF;
  --fg2: #E0E0E8;
  --mt: #7A7A8A;
  --mt2: #52525E;
  --ac: #3b82f6;
  --ac2: #60a5fa;
  --acg: rgba(59,130,246,.35);
  --acs: rgba(59,130,246,.12);
  --rose: #ff385c;
  --rose-dark: #e31c5f;
  --ok: #00FF94;
  --okg: rgba(0,255,148,.18);
  --wn: #FFD600;
  --wng: rgba(255,214,0,.18);
  --dg: #FF1744;
  --dgg: rgba(255,23,68,.18);
  --tl: #00E5FF;
  --tlg: rgba(0,229,255,.18);
  --vp: #B388FF;
  --vpg: rgba(179,136,255,.18);

  /* Semantic gray scale (maps Tailwind-style grays used across owner pages) */
  --gr-white: #ffffff;
  --gr-50:  #0d0d12;
  --gr-100: #14141d;
  --gr-200: #1f1f2a;
  --gr-300: #2d2d38;
  --gr-400: #4a4a58;
  --gr-500: #7a7a8a;
  --gr-600: #9999a6;
  --gr-700: #b7b7c2;
  --gr-800: #d5d5dc;
  --gr-900: #f0f0f5;
}

/* ── Hotel Owner Portal Theme Variables (Light Mode) ── */
[data-theme="light"] {
  --bg: #F5F5F7;
  --bg2: #FFFFFF;
  --bg3: #f0f2f5;
  --card: #FFFFFF;
  --card2: #F8F8FA;
  --card3: #F5F6F8;
  --bdr: #E2E2E8;
  --bdr2: #D0D0D8;
  --bdr3: #bcc2cb;
  --fg: #0A0A0F;
  --fg2: #3A3A45;
  --mt: #8A8A95;
  --mt2: #b0bac6;
  --ac: #3b82f6;
  --ac2: #2f6fed;
  --acg: rgba(59,130,246,.2);
  --acs: rgba(59,130,246,.08);
  --rose: #ff385c;
  --rose-dark: #e31c5f;
  --ok: #00C853;
  --okg: rgba(0,200,83,.15);
  --wn: #FFB300;
  --wng: rgba(255,179,0,.15);
  --dg: #D50000;
  --dgg: rgba(213,0,0,.15);
  --tl: #00B8D4;
  --tlg: rgba(0,184,212,.12);
  --vp: #7C4DFF;
  --vpg: rgba(124,77,255,.12);

  /* Semantic gray scale (Tailwind gray ramp) */
  --gr-white: #ffffff;
  --gr-50:  #fafafa;
  --gr-100: #f5f5f5;
  --gr-200: #e5e7eb;
  --gr-300: #d1d5db;
  --gr-400: #9ca3af;
  --gr-500: #6b7280;
  --gr-600: #4b5563;
  --gr-700: #374151;
  --gr-800: #1f2937;
  --gr-900: #111827;
}

/* ── Owner portal: scoped tokens that WIN the cascade ──
   Other global token sets (styles/theme.css, admin AdminLayout.vue) declare
   the SAME var names on :root / [data-theme] with equal or lower specificity
   but later in the bundle, so they were overriding this file and the toggle
   appeared dead. Scope-limited selectors (0,2,1) below re-assert the owner
   portal's own palette for every element inside .owner-layout-bg without
   affecting the admin or user portals. */
.owner-layout-bg,
html[data-theme="dark"] .owner-layout-bg {
  --bg: #050507;
  --bg2: #0D0D12;
  --bg3: #16161D;
  --card: #111118;
  --card2: #18181F;
  --card3: #1E1E28;
  --bdr: #25252E;
  --bdr2: #35353F;
  --bdr3: #45454F;
  --fg: #FFFFFF;
  --fg2: #E0E0E8;
  --mt: #7A7A8A;
  --mt2: #52525E;
  --ac: #3b82f6;
  --ac2: #60a5fa;
  --acg: rgba(59,130,246,.35);
  --acs: rgba(59,130,246,.12);
  --rose: #ff385c;
  --rose-dark: #e31c5f;
  --ok: #00FF94;
  --okg: rgba(0,255,148,.18);
  --wn: #FFD600;
  --wng: rgba(255,214,0,.18);
  --dg: #FF1744;
  --dgg: rgba(255,23,68,.18);
  --tl: #00E5FF;
  --tlg: rgba(0,229,255,.18);
  --vp: #B388FF;
  --vpg: rgba(179,136,255,.18);
  --gr-white: #ffffff;
  --gr-50:  #0d0d12;
  --gr-100: #14141d;
  --gr-200: #1f1f2a;
  --gr-300: #2d2d38;
  --gr-400: #4a4a58;
  --gr-500: #7a7a8a;
  --gr-600: #9999a6;
  --gr-700: #b7b7c2;
  --gr-800: #d5d5dc;
  --gr-900: #f0f0f5;
}

html[data-theme="light"] .owner-layout-bg {
  --bg: #F5F5F7;
  --bg2: #FFFFFF;
  --bg3: #f0f2f5;
  --card: #FFFFFF;
  --card2: #F8F8FA;
  --card3: #F5F6F8;
  --bdr: #E2E2E8;
  --bdr2: #D0D0D8;
  --bdr3: #bcc2cb;
  --fg: #0A0A0F;
  --fg2: #3A3A45;
  --mt: #8A8A95;
  --mt2: #b0bac6;
  --ac: #3b82f6;
  --ac2: #2f6fed;
  --acg: rgba(59,130,246,.2);
  --acs: rgba(59,130,246,.08);
  --rose: #ff385c;
  --rose-dark: #e31c5f;
  --ok: #00C853;
  --okg: rgba(0,200,83,.15);
  --wn: #FFB300;
  --wng: rgba(255,179,0,.15);
  --dg: #D50000;
  --dgg: rgba(213,0,0,.15);
  --tl: #00B8D4;
  --tlg: rgba(0,184,212,.12);
  --vp: #7C4DFF;
  --vpg: rgba(124,77,255,.12);
  --gr-white: #ffffff;
  --gr-50:  #fafafa;
  --gr-100: #f5f5f5;
  --gr-200: #e5e7eb;
  --gr-300: #d1d5db;
  --gr-400: #9ca3af;
  --gr-500: #6b7280;
  --gr-600: #4b5563;
  --gr-700: #374151;
  --gr-800: #1f2937;
  --gr-900: #111827;
}

/* ── Override global body background ONLY when Owner Portal theme is active ── */
html[data-theme="dark"] body {
  background-color: var(--bg) !important;
  color: var(--fg) !important;
}

html[data-theme="light"] body {
  background-color: var(--bg) !important;
  color: var(--fg) !important;
}

/* Owner pages add the .baco-owner class to <body>, so the backdrop behind the
   owner layout follows the toggle even though body is outside .owner-layout-bg. */
html[data-theme="dark"] body.baco-owner {
  background-color: #050507 !important;
  color: #f5f5f7 !important;
}

html[data-theme="light"] body.baco-owner {
  background-color: #F5F5F7 !important;
  color: #0A0A0F !important;
}
</style>