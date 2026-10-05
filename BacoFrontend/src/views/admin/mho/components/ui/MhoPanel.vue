<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  flush: { type: Boolean, default: false }
})
</script>

<template>
  <section class="mho-panel">
    <header v-if="title || $slots.actions" class="mho-panel__head">
      <div class="mho-panel__heading">
        <i v-if="icon" class="fa-solid" :class="icon"></i>
        <div>
          <h2>{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <div v-if="$slots.actions" class="mho-panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="mho-panel__body" :class="{ 'is-flush': flush }">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.mho-panel {
  background: var(--mho-surface);
  border: 1px solid var(--mho-border);
  border-radius: var(--mho-radius-lg);
  overflow: hidden;
}
.mho-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--mho-border);
}
.mho-panel__heading { display: flex; align-items: center; gap: 13px; min-width: 0; }
.mho-panel__heading > i { font-size: 1.05rem; color: var(--mho-accent); flex-shrink: 0; }
.mho-panel__heading h2 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.mho-panel__heading p { margin: 3px 0 0; font-size: 0.78rem; color: var(--mho-muted); }
.mho-panel__actions { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
.mho-panel__body { padding: 22px; }
/* `flush` is for tables and lists that manage their own row padding. */
.mho-panel__body.is-flush { padding: 0; }
</style>