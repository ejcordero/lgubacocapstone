<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Header from '../components/layout/Header.vue'
import Footer from '../components/layout/Footer.vue'

const router = useRouter()

function humanize(raw) {
  return String(raw).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Every route tagged meta.public becomes an entry — nothing listed manually.
const links = computed(() =>
  router.getRoutes()
    .filter((r) => r.meta?.public && r.name)
    .map((r) => ({
      label: r.meta.infoPage?.title ?? r.meta.title ?? humanize(r.name),
      to: { name: r.name },
      path: r.path,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
)
</script>

<template>
  <Header />
  <main class="sitemap-page">
    <div class="sitemap-wrap">
      <h1>Sitemap</h1>
      <p>All publicly accessible pages of the Municipal Government of Baco website.</p>
      <ul class="sitemap-list">
        <li v-for="l in links" :key="l.path">
          <RouterLink :to="l.to">{{ l.label }}</RouterLink>
          <span class="sitemap-path">{{ l.path }}</span>
        </li>
      </ul>
    </div>
  </main>
  <Footer />
</template>

<style scoped>
.sitemap-page { background: #f5f6f8; min-height: 60vh; padding: 56px 24px; }
.sitemap-wrap { max-width: 820px; margin: 0 auto; }
.sitemap-page h1 { font-family: 'Playfair Display', serif; color: #0b1d35; font-size: 2rem; margin-bottom: 8px; }
.sitemap-page > .sitemap-wrap > p { font-size: .9rem; color: #7a8494; margin-bottom: 28px; }
.sitemap-list { list-style: none; background: #fff; border: 1px solid #e5e8ee; border-top: 3px solid #c0392b; padding: 12px 0; }
.sitemap-list li { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 24px; border-bottom: 1px solid #f0f2f5; }
.sitemap-list li:last-child { border-bottom: none; }
.sitemap-list a { color: #0b1d35; font-size: .92rem; font-weight: 600; text-decoration: none; }
.sitemap-list a:hover { color: #c0392b; }
.sitemap-path { font-size: .75rem; color: #9aa3b2; font-family: monospace; }
</style>