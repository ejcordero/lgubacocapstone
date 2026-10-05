<script setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const items = [
  { path: '/owner',               icon: 'fa-th-large',       label: 'Home',     exact: true },
  { path: '/owner/hotels',        icon: 'fa-building',       label: 'Resort' },
  { path: '/owner/guests',        icon: 'fa-users',            label: 'Guests' },
  { path: '/owner/bookings',      icon: 'fa-calendar-check', label: 'Bookings' },
  { path: '/owner/oreviews',      icon: 'fa-comment-dots',   label: 'Reviews' },
]

const isActive = (item) => item.exact ? route.path === item.path : route.path.startsWith(item.path)
const navigate = (event, path) => {
  event.stopPropagation()
  router.push(path)
}
</script>

<template>
  <nav class="owner-mobile-nav" aria-label="Primary navigation" @click.stop>
    <button
      v-for="item in items"
      :key="item.path"
      type="button"
      class="owner-mobile-nav__item"
      :class="{ 'is-active': isActive(item) }"
      @click.stop="navigate($event, item.path)"
    >
      <i :class="'fas ' + item.icon"></i>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.owner-mobile-nav {
  display: none;
}

@media (max-width: 1024px) {
  .owner-mobile-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 65px;
    background: var(--card);
    border-top: 1px solid var(--bdr);
    z-index: 100;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
  }

  .owner-mobile-nav__item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 0;
    background: transparent;
    color: var(--fg2);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .owner-mobile-nav__item i {
    font-size: 15px;
  }

  .owner-mobile-nav__item.is-active {
    color: var(--ac);
  }
}

@media (min-width: 1025px) {
  .owner-mobile-nav {
    display: none !important;
  }
}
</style>
