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
  <article class="mho-stat" :data-tone="tone">
    <div class="mho-stat__top">
      <span class="mho-stat__label">{{ label }}</span>
      <i v-if="icon" class="fa-solid mho-stat__icon" :class="icon"></i>
    </div>
    <div class="mho-stat__value">{{ value }}</div>
    <div v-if="hint" class="mho-stat__hint">{{ hint }}</div>
  </article>
</template>

<style scoped>
.mho-stat {
  padding: 18px 20px;
  background: var(--mho-surface);
  border: 1px solid var(--mho-border);
  border-radius: var(--mho-radius-lg);
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative;
  overflow: hidden;
}
/* Tone is a left rail, not a full wash — a filled card would fight the number. */
.mho-stat::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--mho-border-2);
}
.mho-stat[data-tone='accent']::before { background: var(--mho-accent); }
.mho-stat[data-tone='ok']::before     { background: var(--mho-ok); }
.mho-stat[data-tone='warn']::before   { background: var(--mho-warn); }
.mho-stat[data-tone='danger']::before { background: var(--mho-danger); }
.mho-stat[data-tone='info']::before   { background: var(--mho-info); }

.mho-stat__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.mho-stat__label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mho-muted);
}
.mho-stat__icon { font-size: 0.9rem; color: var(--mho-muted-2); }
.mho-stat__value {
  font-size: 1.85rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--mho-fg);
}
.mho-stat__hint { font-size: 0.75rem; color: var(--mho-muted); }
</style>