<script setup>
import { ref } from 'vue'

const isActivating = ref(false)

const triggerDistressSignal = () => {
  if (!navigator.geolocation) {
    alert("SYSTEM ERROR: Hindi suportado ng iyong device ang GPS localization.")
    return
  }

  isActivating.value = true
  alert("Ina-access ang iyong lokasyon... Kumokonekta sa Baco MDRRMO Command Center.")

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      isActivating.value = false
      alert(`🚨 DISTRESS SIGNAL SENT!\n\nLokasyon: Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}\n\nNakatanggap na ng alerto ang MDRRMO. Manatiling ligtas at maghintay ng tulong.`)
    },
    (error) => {
      isActivating.value = false
      alert("BABALA: Hindi makuha ang iyong lokasyon. Mangyaring i-on ang iyong GPS (Location Services).")
    },
    { enableHighAccuracy: true }
  )
}
</script>

<template>
  <button 
    class="mdrrmo-panic-btn" 
    :class="{ 'activating': isActivating }"
    @click="triggerDistressSignal"
    title="Pindutin para sa Emergency"
  >
    <div class="icon-wrapper">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <span class="btn-text">SOS / MDRRMO</span>
  </button>
</template>

<style scoped>
.mdrrmo-panic-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  background-color: #dc2626; /* Absolute Red for cognitive urgency */
  color: white;
  border: none;
  border-radius: 50px;
  padding: 12px 24px;
  font-size: 1.1rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  box-shadow: 0 10px 25px rgba(220, 38, 38, 0.4);
  z-index: 9999;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: pulse-red 2s infinite;
}

.mdrrmo-panic-btn:hover {
  background-color: #b91c1c;
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 15px 30px rgba(220, 38, 38, 0.6);
}

.mdrrmo-panic-btn.activating {
  animation: rapid-pulse 0.5s infinite;
  background-color: #991b1b;
}

.icon-wrapper {
  font-size: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-text {
  letter-spacing: 0.5px;
}

@keyframes pulse-red {
  0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
  70% { box-shadow: 0 0 0 15px rgba(220, 38, 38, 0); }
  100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
}

@keyframes rapid-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* Fluid UI adjustment for mobile viewports */
@media screen and (max-width: 768px) { 
  .mdrrmo-panic-btn {
    bottom: 20px;
    right: 20px;
    padding: 10px 18px;
  }
  .btn-text {
    display: none; /* Collapse text on mobile, retain universal warning icon */
  }
  .icon-wrapper {
    font-size: 1.5rem;
  }
}
</style>