<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  hint:  { type: String, default: '' },
  icon:  { type: String, default: '' },
  tone:  { type: String, default: 'neutral' } // neutral | accent | ok | warn | danger | info
})
</script>

<template>
  <article class="tr-stat" :data-tone="tone">
    <div class="tr-stat__top">
      <span class="tr-stat__label">{{ label }}</span>
      <i v-if="icon" class="fa-solid tr-stat__icon" :class="icon"></i>
    </div>
    <div class="tr-stat__value">{{ value }}</div>
    <div v-if="hint" class="tr-stat__hint">{{ hint }}</div>
  </article>
</template>

<style scoped>
.tr-stat {
  padding: 18px 20px;
  background: var(--tr-surface);
  border: 1px solid var(--tr-border);
  border-radius: var(--tr-radius-lg);
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative;
  overflow: hidden;
}
/* Tone is a left rail, not a full wash — a filled card would fight the number. */
.tr-stat::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--tr-border-2);
}
.tr-stat[data-tone='accent']::before { background: var(--tr-accent); }
.tr-stat[data-tone='ok']::before     { background: var(--tr-ok); }
.tr-stat[data-tone='warn']::before   { background: var(--tr-warn); }
.tr-stat[data-tone='danger']::before { background: var(--tr-danger); }
.tr-stat[data-tone='info']::before   { background: var(--tr-info); }

.tr-stat__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.tr-stat__label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tr-muted);
}
.tr-stat__icon { font-size: 0.9rem; color: var(--tr-muted-2); }
.tr-stat__value {
  font-size: 1.85rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--tr-fg);
}
.tr-stat__hint { font-size: 0.75rem; color: var(--tr-muted); }
</style>