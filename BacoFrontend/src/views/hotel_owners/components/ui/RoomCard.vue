<script setup>
import StatusBadge from './StatusBadge.vue';

const props = defineProps({ room: { type: Object, required: true } });
const emit = defineEmits(['view', 'edit']);
</script>

<template>
  <div class="room-card" @click="emit('view', room)">
    <div class="room-header">
      <div>
        <div class="room-name">{{ room.room_type || room.name }}</div>
        <div class="room-type">{{ room.type || room.room_type }} · {{ room.hotel }}</div>
      </div>
      <div class="price-section">
        <div class="price">₱{{ (room.price_per_night || room.price || 0).toLocaleString() }}<span>/night</span></div>
        <StatusBadge :status="room.status || 'available'" size="sm" />
      </div>
    </div>
    <div class="room-details">
      <div>Capacity: <strong>{{ room.capacity }}</strong> guests</div>
      <div>ID: <strong>{{ room.id }}</strong></div>
    </div>
    <div class="amenities">
      <span v-for="(amenity, i) in (room.amenities ? (typeof room.amenities === 'string' ? JSON.parse(room.amenities) : room.amenities) : [])" :key="i">
        {{ amenity }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.room-card {
  background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; padding: 18px;
  cursor: pointer; transition: all .35s cubic-bezier(.22,1,.36,1); animation: fadeIn .5s ease both;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
.room-card:hover { border-color: var(--bdr2); transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,.1); }
.room-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 10px; }
.room-name { font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 700; color: var(--fg); letter-spacing: -0.02em; transition: color .3s; }
.room-type { font-size: 11px; color: var(--mt); margin-top: 2px; transition: color .3s; }
.price-section { text-align: right; }
.price { font-family: 'Unbounded', sans-serif; font-size: 20px; font-weight: 800; color: var(--ac); letter-spacing: -0.02em; transition: color .3s; }
.price span { font-size: 10px; font-weight: 400; color: var(--mt); transition: color .3s; }
.room-details { display: flex; gap: 16px; margin: 12px 0; padding: 10px 0; border-top: 1px solid var(--bdr); border-bottom: 1px solid var(--bdr); font-size: 11px; color: var(--mt); transition: color .3s, border-color .3s; }
.room-details strong { color: var(--fg); font-weight: 700; transition: color .3s; }
.amenities { display: flex; flex-wrap: wrap; gap: 6px; }
.amenities span { font-size: 10px; padding: 3px 8px; border-radius: 5px; background: var(--bg2); color: var(--mt); border: 1px solid var(--bdr); font-weight: 600; transition: all .2s; }
.room-card:hover .amenities span { border-color: var(--bdr2); color: var(--fg2); }
</style>