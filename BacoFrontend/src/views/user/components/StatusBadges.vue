<template>
  <span :class="badgeClasses">
    <slot />
  </span>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  type: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'success', 'warning', 'danger', 'gray'].includes(value)
  },
  size: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'small', 'large'].includes(value)
  }
});

const badgeClasses = computed(() => {
  const baseClasses = ['badge'];
  const typeClasses = {
    default: 'bg-blue',
    success: 'bg-green',
    warning: 'bg-yellow',
    danger: 'bg-red',
    gray: 'bg-gray'
  };
  
  const sizeClasses = {
    default: 'px-2 py-1 text-xs',
    small: 'px-1 py-0.5 text-xs',
    large: 'px-3 py-1.5 text-sm'
  };
  
  baseClasses.push(typeClasses[props.type]);
  baseClasses.push(sizeClasses[props.size]);
  
  return baseClasses;
});
</script>

<style scoped>
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
  text-transform: uppercase;
}

/* Status Colors */
.bg-blue {
  background: var(--bb-info-soft);
  color: var(--bb-info);
}

.bg-green {
  background: var(--bb-success-soft);
  color: var(--bb-success);
}

.bg-yellow {
  background: var(--bb-warning-soft);
  color: var(--bb-warning);
}

.bg-red {
  background: var(--bb-danger-soft);
  color: var(--bb-danger);
}

.bg-gray {
  background: var(--sand-2);
  color: var(--muted);
}

/* Size Variations */
.text-xs {
  font-size: var(--bb-text-xs);
}

.text-sm {
  font-size: var(--bb-text-base);
}
</style>
