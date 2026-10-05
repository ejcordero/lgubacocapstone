<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  flush: { type: Boolean, default: false }
})
</script>

<template>
  <section class="tr-panel">
    <header v-if="title || $slots.actions" class="tr-panel__head">
      <div class="tr-panel__heading">
        <i v-if="icon" class="fa-solid" :class="icon"></i>
        <div>
          <h2>{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <div v-if="$slots.actions" class="tr-panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="tr-panel__body" :class="{ 'is-flush': flush }">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.tr-panel {
  background: var(--tr-surface);
  border: 1px solid var(--tr-border);
  border-radius: var(--tr-radius-lg);
  overflow: hidden;
}
.tr-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--tr-border);
}
.tr-panel__heading { display: flex; align-items: center; gap: 13px; min-width: 0; }
.tr-panel__heading > i { font-size: 1.05rem; color: var(--tr-accent); flex-shrink: 0; }
.tr-panel__heading h2 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.tr-panel__heading p { margin: 3px 0 0; font-size: 0.78rem; color: var(--tr-muted); }
.tr-panel__actions { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
.tr-panel__body { padding: 22px; }
/* `flush` is for tables and lists that manage their own row padding. */
.tr-panel__body.is-flush { padding: 0; }
</style>