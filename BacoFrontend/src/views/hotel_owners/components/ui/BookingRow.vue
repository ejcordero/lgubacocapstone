<script setup>
import StatusBadge from './StatusBadge.vue';

const props = defineProps({
  booking: { type: Object, required: true }
});

const emit = defineEmits(['view', 'update-status']);
</script>

<template>
  <tr class="booking-row" @click="emit('view', booking)">
    <td class="id-cell">{{ booking.id }}</td>
    <td class="guest-cell">{{ booking.guest }}</td>
    <td>{{ booking.hotel }}</td>
    <td>{{ booking.room }}</td>
    <td>{{ booking.checkIn }}</td>
    <td>{{ booking.checkOut }}</td>
    <td class="amount">₱{{ booking.amount.toLocaleString() }}</td>
    <td>
      <StatusBadge :status="booking.status" size="sm" />
    </td>
    <td>
      <button class="action-btn" @click.stop="emit('update-status', booking)">
        <i class="fas fa-ellipsis-h"></i>
      </button>
    </td>
  </tr>
</template>

<style scoped>
.booking-row {
  transition: background .2s;
  cursor: pointer;
}

.booking-row:hover {
  background: rgba(255,61,0,.06);
}

.id-cell, .guest-cell {
  font-weight: 700;
  color: var(--fg);
}

.amount {
  font-weight: 700;
  color: var(--fg);
}

.action-btn {
  background: transparent;
  color: #F20707;
  border: none;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 11px;
  transition: all .2s;
}

.action-btn:hover {
  background: rgba(255,61,0,.1);
  transform: scale(1.1);
}
</style>