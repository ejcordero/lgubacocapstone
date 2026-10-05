<template>
  <div class="booking-card">
    <div class="flex-align-gap">
      <img :src="booking.hotel.image" class="booking-thumb" alt="Hotel" />
      <div>
        <h4>{{ booking.hotel.name }}</h4>
        <p class="text-sm text-muted">
          {{ booking.details.checkIn }} to {{ booking.details.checkOut }}
        </p>
        <p class="text-xs text-muted">Ref: {{ booking.id }}</p>
      </div>
    </div>
    <div class="text-right">
      <span class="badge badge-green mb-1 inline-block">Confirmed</span>
      <p class="text-danger fw-bold">₱{{ booking.totalPrice }}</p>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  booking: {
    type: Object,
    required: true
  }
});
</script>

<style scoped>
.booking-card {
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bb-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--bb-shadow-sm); border: 1px solid var(--border);
}

.booking-thumb {
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.text-sm {
  font-size: var(--bb-text-base);
}

.text-muted {
  color: var(--c-muted);
}

.text-xs {
  font-size: var(--bb-text-xs);
}

.text-danger {
  color: var(--c-danger);
}

.fw-bold {
  font-weight: var(--bb-weight-bold);
}

/* Badges */
.badge {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
}

.badge-green {
  background: var(--bb-success-soft);
  color: var(--bb-success);
}

/* Responsive */
@media (max-width: 768px) {
  .booking-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .booking-thumb {
    width: 100%;
    height: 12rem;
  }
  
  .text-right {
    width: 100%;
    text-align: right;
  }
}
</style>
