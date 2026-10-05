<template>
  <div class="permit-card hoverable" @click="handleViewPermit">
    <div class="flex-align-gap w-full md-w-auto">
      <div :class="['icon-box shrink-0', permit.status === 'Approved' ? 'green' : 'yellow']">
        <Mountain size="28" />
      </div>
      <div>
        <h3 class="fw-bold text-primary text-lg">{{ permit.id }}</h3>
        <p class="text-sm text-muted flex-align-gap">
          <Calendar size="14" />
          Trek Date: <span class="fw-bold">{{ permit.trekDate }}</span>
        </p>
        <p class="text-xs text-muted mt-xs">
          Submitted on {{ permit.submitDate }}
        </p>
      </div>
    </div>
    <div class="permit-card-right">
      <div class="text-right">
        <span :class="['badge mb-xs inline-block', permit.status === 'Approved' ? 'badge-green' : 'badge-yellow']">
          {{ permit.status }}
        </span>
        <p class="text-sm fw-bold text-muted">{{ permit.groupSize }} Pax</p>
      </div>
        <ChevronRight class="permit-chevron desktop-only" />

    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { 
  Mountain, Calendar, 
  ChevronRight, Loader2 
} from 'lucide-vue-next';

const props = defineProps({
  permit: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['view-permit']);

const handleViewPermit = () => {
  emit('view-permit', props.permit);
};
</script>

<style scoped>
.permit-card {
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bb-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--bb-shadow-sm); border: 1px solid var(--border);
  transition: transform 0.2s;
  cursor: pointer;
}

.permit-card:hover {
  transform: translateY(-2px);
}

.icon-box {
  padding: 0.75rem;
  border-radius: var(--radius-md);
}

.icon-box.green {
  background: var(--bb-success-soft);
  color: var(--bb-success);
}

.icon-box.yellow {
  background: var(--bb-warning-soft);
  color: var(--bb-warning);
}

.permit-card-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-left: 1.5rem;
  border-left: 1px solid var(--c-border);
}

/* Badges */
.badge {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
}

.badge.lg {
  padding: 0.5rem 1rem;
  font-size: var(--bb-text-base);
}

.badge-green {
  background: var(--bb-success-soft);
  color: var(--bb-success);
}

.badge-yellow {
  background: var(--bb-warning-soft);
  color: var(--bb-warning);
}

.text-sm {
  font-size: var(--bb-text-base);
}

.text-muted {
  color: var(--c-muted);
}

.fw-bold {
  font-weight: var(--bb-weight-bold);
}

.text-primary {
color: var(--c-primary);
}

/* Replaces the text-gray-400 utility, which resolved to a static Tailwind
   value and so ignored the dark-mode flip. */
.permit-chevron {
color: var(--bb-text-tertiary);
}


.text-lg {
  font-size: var(--bb-text-xl);
}

.text-xs {
  font-size: var(--bb-text-xs);
}

.mt-xs {
  margin-top: 0.25rem;
}

.mb-xs {
  margin-bottom: 0.25rem;
}

/* Responsive */
@media (max-width: 768px) {
  .permit-card-right {
    padding-left: 0;
    border-left: none;
    width: 100%;
    justify-content: space-between;
  }
  
  .desktop-only {
    display: none;
  }
}
</style>
