<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: { type: String, required: true },
  size: { type: String, default: 'md' }
});

const statusConfig = {
  // Green states
  verified: { label: 'Verified', color: 'var(--ok)', bg: 'var(--okg)' },
  active: { label: 'Active', color: 'var(--ok)', bg: 'var(--okg)' },
  confirmed: { label: 'Confirmed', color: 'var(--ok)', bg: 'var(--okg)' },
  paid: { label: 'Paid', color: 'var(--ok)', bg: 'var(--okg)' },
  available: { label: 'Available', color: 'var(--ok)', bg: 'var(--okg)' },
  completed: { label: 'Completed', color: 'var(--tl)', bg: 'var(--tlg)' },
  approved: { label: 'Approved', color: 'var(--ok)', bg: 'var(--okg)' },

  // Yellow states
  pending: { label: 'Pending', color: 'var(--wn)', bg: 'var(--wng)' },
  pending_approval: { label: 'Pending Approval', color: 'var(--wn)', bg: 'var(--wng)' },
  maintenance: { label: 'Maintenance', color: 'var(--wn)', bg: 'var(--wng)' },
  checked_in: { label: 'Checked In', color: 'var(--tl)', bg: 'var(--tlg)' },

  // Red states
  suspended: { label: 'Suspended', color: 'var(--dg)', bg: 'var(--dgg)' },
  cancelled: { label: 'Cancelled', color: 'var(--dg)', bg: 'var(--dgg)' },
  overdue: { label: 'Overdue', color: 'var(--dg)', bg: 'var(--dgg)' },
  closed: { label: 'Closed', color: 'var(--dg)', bg: 'var(--dgg)' },
  rejected: { label: 'Rejected', color: 'var(--dg)', bg: 'var(--dgg)' },

  // Violet states
  occupied: { label: 'Occupied', color: '#D9B384', bg: 'rgba(179,136,255,.15)' },

  // Cyan states
  under_review: { label: 'Under Review', color: 'var(--tl)', bg: 'var(--tlg)' }
};

const config = computed(() => {
  const key = props.status.toLowerCase().replace(/ /g, '_');
  return statusConfig[key] || {
    label: props.status,
    color: 'var(--fg2)',
    bg: 'var(--bg2)'
  };
});
</script>

<template>
  <span
    class="status-badge"
    :class="[size]"
    :style="{
      color: config.color,
      background: config.bg,
      borderColor: config.color
    }"
  >
    <span class="dot" :style="{ background: config.color }"></span>
    {{ config.label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 700;
  text-transform: capitalize;
  letter-spacing: .3px;
  border: 1px solid;
  white-space: nowrap;
  transition: all .2s;
}

.status-badge.sm {
  font-size: 9px;
  padding: 2px 7px;
  gap: 4px;
}

.status-badge.lg {
  font-size: 12px;
  padding: 6px 12px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-badge.sm .dot {
  width: 5px;
  height: 5px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
}

.status-badge:hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
}
</style>