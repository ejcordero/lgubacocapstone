<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], required: true },
  icon: { type: String, required: true },
  color: { type: String, default: '#F20707' },
  change: { type: String, default: '' },
  up: { type: Boolean, default: true },
  prefix: { type: String, default: '' },
  suffix: { type: String, default: '' }
});

const displayValue = ref(0);

onMounted(() => {
  const numValue = parseFloat(String(props.value).replace(/[^0-9.]/g, ''));
  if (isNaN(numValue)) { displayValue.value = props.value; return; }
  const duration = 1500, start = performance.now();
  function animate(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    displayValue.value = numValue * eased;
    if (progress < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
});

const formatValue = () => {
  const v = displayValue.value;
  if (typeof v === 'string') return v;
  if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
  if (v >= 1000 && !String(props.value).includes('.')) return Math.floor(v).toLocaleString();
  if (String(props.value).includes('.')) return v.toFixed(1);
  return Math.floor(v).toLocaleString();
};
</script>

<template>
  <div class="stat-card">
    <div class="glow" :style="{ background: color }"></div>
    <div class="stat-header">
      <div class="icon" :style="{ background: color + '18', color: color }">
        <i :class="'fas ' + icon"></i>
      </div>
      <div v-if="change" class="change" :class="{ up: up, down: !up }">
        <i :class="up ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i> {{ change }}
      </div>
    </div>
    <div class="label">{{ label }}</div>
    <div class="value" :style="{ color: color }">
      <span v-if="prefix" class="prefix">{{ prefix }}</span>
      {{ formatValue() }}
      <span v-if="suffix" class="suffix">{{ suffix }}</span>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; padding: 20px;
  position: relative; overflow: hidden; cursor: pointer; transition: all .35s cubic-bezier(.22,1,.36,1);
}
.stat-card:hover { border-color: var(--bdr2); transform: translateY(-6px); box-shadow: 0 20px 60px rgba(0,0,0,.1); }
.stat-card:hover .glow { opacity: .9; }
.stat-card:hover .icon { transform: rotate(-10deg) scale(1.1); }
.glow { position: absolute; top: -40px; right: -40px; width: 120px; height: 120px; border-radius: 50%; filter: blur(50px); opacity: .5; transition: opacity .3s; }
.stat-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: transform .3s; }
.change { font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 6px; }
.change.up { color: var(--ok); background: var(--okg); }
.change.down { color: var(--dg); background: var(--dgg); }
.label { font-size: 10px; color: var(--mt); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; transition: color .3s; }
.value { font-family: 'Unbounded', sans-serif; font-size: 32px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; transition: color .3s; }
.prefix, .suffix { font-size: 20px; opacity: .8; }
@media (max-width: 640px) { .value { font-size: 24px; } .prefix, .suffix { font-size: 16px; } }
</style>