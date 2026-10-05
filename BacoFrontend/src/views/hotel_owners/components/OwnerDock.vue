<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const props = defineProps({
  items: {
    type: Array,
    default: () => [
      { icon: 'fa-user-edit', label: 'Edit Profile', route: '/owner/profile' },
      { icon: 'fa-cloud-upload-alt', label: 'Upload ID', route: '/owner/verification' },
      { icon: 'fa-key', label: 'Password', route: '/owner/settings' },
      { icon: 'fa-plus-circle', label: 'Add Hotel', route: '/owner/hotels' },
      { icon: 'fa-chart-line', label: 'Analytics', route: '/owner/revenue' },
      { icon: 'fa-cog', label: 'Settings', route: '/owner/settings' }
    ]
  }
})

const handleAction = (item) => {
  if (item.route) router.push(item.route)
  if (item.onClick && typeof item.onClick === 'function') item.onClick()
}
</script>

<template>
  <div class="quick-grid">
    <div 
      v-for="(item, i) in items" 
      :key="i" 
      class="quick-action" 
      @click="handleAction(item)"
    >
      <div class="action-icon">
        <i :class="'fas ' + item.icon"></i>
      </div>
      <span class="action-label">{{ item.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.quick-grid { 
  display: grid; 
  grid-template-columns: repeat(2, 1fr); 
  gap: 12px; 
  width: 100%;
}

.quick-action { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; /* Ensures perfect vertical centering */
  gap: 8px; 
  padding: 20px 12px; 
  border-radius: 12px; 
  background: var(--bg2); 
  border: 1px solid var(--bdr); 
  cursor: pointer; 
  color: var(--fg2); 
  font-size: 11px; 
  font-weight: 700; 
  text-transform: uppercase; 
  letter-spacing: 0.5px; 
  text-align: center; 
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1); 
  user-select: none;
  height: 100%; /* Forces all grid items to be the exact same height */
  box-sizing: border-box;
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--card);
  color: var(--fg);
  font-size: 18px;
  transition: all 0.3s ease;
}

.action-label {
  line-height: 1.3;
}

.quick-action:hover { 
  border-color: var(--ac); 
  color: var(--ac); 
  background: var(--acs); 
  transform: translateY(-4px); 
  box-shadow: 0 8px 20px rgba(0,0,0,0.1); 
}

.quick-action:hover .action-icon { 
  background: var(--ac);
  color: #fff;
  transform: scale(1.1) rotate(-5deg); 
}

.quick-action:active {
  transform: translateY(-2px) scale(0.98);
}

/* Mobile adjustments */
@media (max-width: 480px) {
  .quick-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .quick-action {
    padding: 16px 8px;
  }
  .action-icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
  .action-label {
    font-size: 10px;
  }
}
</style>