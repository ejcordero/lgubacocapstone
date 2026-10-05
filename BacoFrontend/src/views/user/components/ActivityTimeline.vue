<template>
  <div class="activity-timeline">
    <div v-for="(event, index) in events" :key="index" class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <p class="fw-bold text-sm">{{ event.action }}</p>
        <p class="text-xs text-muted">{{ event.date }}</p>
        <p v-if="event.description" class="text-xs text-muted mt-xs">
          {{ event.description }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  events: {
    type: Array,
    required: true,
    default: () => []
  }
});
</script>

<style scoped>
.activity-timeline {
  border-left: 2px solid var(--c-border);
  margin-left: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.timeline-item {
  padding-left: 1.5rem;
  position: relative;
}

.timeline-dot {
  position: absolute;
  left: -9px;
  top: 0.25rem;
  width: 1rem;
  height: 1rem;
  background: var(--c-danger);
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.timeline-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.fw-bold {
  font-weight: var(--bb-weight-bold);
}

.text-sm {
  font-size: var(--bb-text-base);
}

.text-xs {
  font-size: var(--bb-text-xs);
}

.text-muted {
  color: var(--c-muted);
}

.mt-xs {
  margin-top: 0.25rem;
}
</style>
