<script setup>
import StatusBadge from './StatusBadge.vue';

const props = defineProps({ 
  hotel: { type: Object, required: true } 
});

const emit = defineEmits(['view', 'edit', 'delete']);
</script>

<template>
  <div class="hotel-card" @click="emit('view', hotel)">
    <div class="image" :style="{ backgroundImage: `url(${hotel.image})` }">
      <div class="overlay"></div>
      <div class="category">{{ hotel.type || hotel.category }}</div>
      <div class="stars"><i class="fas fa-star"></i> {{ hotel.stars || hotel.rating }}</div>
    </div>
    <div class="body">
      <h4>{{ hotel.name }}</h4>
      <div class="address"><i class="fas fa-map-marker-alt"></i> {{ hotel.location || hotel.address }}</div>
      <div class="stats">
        <div><div class="stat-value">{{ hotel.rooms || 0 }}</div><div class="stat-label">Rooms</div></div>
        <div><div class="stat-value">{{ hotel.bookings || 0 }}</div><div class="stat-label">Bookings</div></div>
        <div><div class="stat-value">{{ hotel.revenue || '₱0' }}</div><div class="stat-label">Revenue</div></div>
      </div>
      <div class="footer">
        <div class="rating"><i class="fas fa-star"></i> <strong>{{ hotel.rating || '0.0' }}</strong></div>
        <StatusBadge :status="hotel.status || 'active'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.hotel-card {
  background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; overflow: hidden;
  cursor: pointer; transition: all .35s cubic-bezier(.22,1,.36,1); animation: fadeIn .5s ease both;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
.hotel-card:hover { border-color: var(--bdr2); transform: translateY(-6px); box-shadow: 0 20px 60px rgba(0,0,0,.1); }
.hotel-card:hover .image { transform: scale(1.05); }
.image { height: 160px; background-size: cover; background-position: center; position: relative; transition: transform .5s; }
.overlay { position: absolute; inset: 0; background: linear-gradient(transparent 40%, rgba(0,0,0,.7)); }
.category { position: absolute; top: 12px; left: 12px; background: var(--ac); padding: 4px 10px; border-radius: 8px; font-size: 10px; color: #fff; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
.stars { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,.6); backdrop-filter: blur(10px); padding: 4px 10px; border-radius: 8px; font-size: 11px; color: var(--wn); font-weight: 700; display: flex; align-items: center; gap: 4px; }
.body { padding: 16px; }
.body h4 { font-family: 'Unbounded', sans-serif; font-size: 17px; font-weight: 700; color: var(--fg); margin: 0 0 4px; letter-spacing: -0.02em; transition: color .3s; }
.address { color: var(--mt); font-size: 11.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 5px; transition: color .3s; }
.stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.stats > div { text-align: center; padding: 8px; background: var(--bg2); border-radius: 8px; transition: background-color .3s; }
.stat-value { font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 700; color: var(--fg); transition: color .3s; }
.stat-label { font-size: 9px; color: var(--mt); text-transform: uppercase; letter-spacing: .5px; font-weight: 600; transition: color .3s; }
.footer { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; }
.rating { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--wn); font-weight: 700; }
</style>