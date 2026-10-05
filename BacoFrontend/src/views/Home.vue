<script setup>
import HomeHero     from '../components/sections/HomeHero.vue'
import HomeMayor    from '../components/sections/HomeMayor.vue'
import HomeNews     from '../components/sections/HomeNews.vue'
import HomeServices from '../components/sections/HomeServices.vue'
import HomeStats    from '../components/sections/HomeStats.vue'
</script>

<template>
  <div class="home-layout">
    <HomeHero />
    <HomeServices />
    <HomeNews />
    <HomeMayor />
    <HomeStats />
    <div
      class="elfsight-app-fa158e9d-0a50-4d33-9c18-c6870bfad175"
      data-elfsight-app-lazy
    ></div>
  </div>
</template>

<style>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css');
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=Inter:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  overflow-x: hidden;
}

html { font-size: 16px; scroll-behavior: smooth; }

body {
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #ffffff;
  color: #0f1628;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Playfair Display', serif;
  color: #0B198F;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

.home-layout {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}
</style>