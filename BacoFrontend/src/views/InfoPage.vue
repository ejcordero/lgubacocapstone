<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Header from '../components/layout/Header.vue'
import Footer from '../components/layout/Footer.vue'

const route = useRoute()
const page = computed(() => route.meta.infoPage ?? { title: 'Information', sections: [] })
</script>

<template>
  <Header />
  <main class="info-page">
    <div class="info-wrap">
      <h1>{{ page.title }}</h1>
      <p v-if="page.updated" class="info-updated">Last updated: {{ page.updated }}</p>

      <section v-for="(section, i) in page.sections" :key="i" class="info-section">
        <h2 v-if="section.heading">{{ section.heading }}</h2>
        <p v-for="(p, j) in section.paragraphs ?? []" :key="j">{{ p }}</p>
        <ul v-if="section.list">
          <li v-for="(item, k) in section.list" :key="k">{{ item }}</li>
        </ul>
      </section>
    </div>
  </main>
  <Footer />
</template>

<style scoped>
.info-page { background: #f5f6f8; min-height: 60vh; padding: 56px 24px; }
.info-wrap { max-width: 820px; margin: 0 auto; }
.info-page h1 { font-family: 'Playfair Display', serif; color: #0b1d35; font-size: 2rem; margin-bottom: 8px; }
.info-updated { font-size: .8rem; color: #7a8494; margin-bottom: 28px; }
.info-section { background: #fff; border: 1px solid #e5e8ee; border-top: 3px solid #c0392b; padding: 24px 28px; margin-bottom: 18px; }
.info-section h2 { font-size: 1.05rem; color: #0b1d35; margin-bottom: 10px; }
.info-section p { font-size: .9rem; line-height: 1.7; color: #3c4657; margin-bottom: 10px; }
.info-section ul { margin: 8px 0 0 18px; }
.info-section li { font-size: .9rem; line-height: 1.7; color: #3c4657; margin-bottom: 6px; }
</style>