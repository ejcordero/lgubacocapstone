<template>
  <div class="settings-page">
    <!-- Top navigation -->
    <header class="settings-header">
      <button type="button" class="back-btn" aria-label="Back">
        <ChevronLeft :size="20" stroke-width="2.4" />
      </button>
      <h1 class="settings-title">Settings</h1>
    </header>

    <!-- Body -->
    <main class="settings-body">
      <!-- Card 1: five stacked settings rows -->
      <section class="settings-card">
        <div v-for="row in primaryRows" :key="row.label" class="settings-row">
          <span class="row-icon"><component :is="row.icon" :size="19" stroke-width="1.9" /></span>
          <span class="row-label">{{ row.label }}</span>
          <ChevronRight class="row-chevron" :size="18" />
        </div>
      </section>

      <!-- Premium Status card -->
      <div class="settings-card premium-card">
        <span class="row-icon"><Crown :size="19" stroke-width="1.9" /></span>
        <span class="row-label">Premium</span>
        <span class="premium-status">Inactive</span>
        <ChevronRight class="row-chevron" :size="18" />
      </div>

      <!-- Promotional banner -->
      <div class="promo-banner">
        <div class="promo-copy">
          <span class="promo-title">Refer a friend</span>
          <span class="promo-sub">50&#8202;/&#8202;referral</span>
        </div>
        <span class="promo-illustration">🐼</span>
      </div>

      <!-- Card 2: two stacked settings rows -->
      <section class="settings-card">
        <div v-for="row in secondaryRows" :key="row.label" class="settings-row">
          <span class="row-icon"><component :is="row.icon" :size="19" stroke-width="1.9" /></span>
          <span class="row-label">{{ row.label }}</span>
          <ChevronRight class="row-chevron" :size="18" />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import {
  ChevronLeft, ChevronRight,
  Mail, UserRound, Footprints, Languages, ShieldCheck,
  Crown, AppWindow, MonitorSmartphone
} from 'lucide-vue-next'

const primaryRows = [
  { icon: Mail,          label: 'Email' },
  { icon: UserRound,     label: 'Username' },
  { icon: Footprints,    label: 'Step data' },
  { icon: Languages,     label: 'Language' },
  { icon: ShieldCheck,   label: 'Privacy' },
]

const secondaryRows = [
  { icon: AppWindow,         label: 'App Icon' },
  { icon: MonitorSmartphone, label: 'Widget' },
]
</script>

<style scoped>
/* ── Page shell ──────────────────────── */
.settings-page {
  min-height: 100%;
  background: var(--bb-bg);
  font-family: var(--bb-font-body);
  color: var(--bb-ink);
  display: flex;
  flex-direction: column;
}

/* ═══ BASE: mobile-first (≤480px) ══════════════════════
   Compact sizing so every card, row and button breathes
   on small screens while staying tappable.             */
.settings-page {
  justify-content: flex-start;
}

/* ── Top navigation ──────────────────── */
.settings-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px clamp(14px, 4vw, 20px);
}

.back-btn {
  position: absolute;
  left: clamp(14px, 4vw, 20px);
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: none;
  background: var(--bb-surface);
  color: var(--bb-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
.back-btn svg { width: 18px; height: 18px; }

.settings-title {
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-bold);
  letter-spacing: -0.01em;
  margin: 0;
}

/* ── Body ────────────────────────────── */
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px clamp(14px, 4vw, 20px) 44px;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}

/* ── Cards & rows ────────────────────── */
.settings-card {
  background: var(--bb-surface);
  border-radius: 18px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  padding: 0 clamp(12px, 3vw, 20px);
  display: flex;
  flex-direction: column;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: clamp(48px, 7vh, 56px);
  border-bottom: 1px solid var(--bb-border);
}

.settings-row:last-child { border-bottom: none; }

.row-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--bb-text-tertiary);
}
.row-icon svg { width: 17px; height: 17px; }

.row-label {
  flex: 1;
  min-width: 0;
  font-size: var(--bb-text-md);
  font-weight: var(--bb-weight-medium);
  color: var(--bb-ink);
}

.row-chevron {
  display: flex;
  flex-shrink: 0;
  color: var(--bb-border-strong);
}
.row-chevron svg { width: 16px; height: 16px; }

/* ── Premium status card ─────────────── */
.premium-card {
  align-items: center;
  height: clamp(48px, 7vh, 56px);
}

.premium-status {
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-medium);
  color: var(--bb-text-tertiary);
  flex-shrink: 0;
}

/* ── Promotional banner ──────────────── */
.promo-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px clamp(14px, 3.5vw, 20px);
  border-radius: 18px;
  background: linear-gradient(135deg, #F2994A, #E67E22);
  box-shadow: 0 4px 14px rgba(230, 126, 34, 0.25);
}

.promo-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.promo-title {
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-bold);
  color: #FFFFFF;
  letter-spacing: -0.01em;
}

.promo-sub {
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-medium);
  color: rgba(255, 255, 255, 0.8);
}

.promo-illustration {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--bb-text-2xl);
  box-shadow: 0 2px 8px rgba(143, 72, 0, 0.15);
}

/* ═══ TINY SCREENS (≤359px) ══════════════════════════ */
@media (max-width: 359px) {
  .settings-body { gap: 14px; }
  .settings-row   { height: 46px; gap: 10px; }
  .premium-card   { height: 46px; }
  .row-icon svg   { width: 16px; height: 16px; }
  .row-label      { font-size: var(--bb-text-base); }
  .row-chevron svg { width: 15px; height: 15px; }
  .promo-banner   { padding: 14px 14px; }
  .promo-illustration { width: 38px; height: 38px; font-size: var(--bb-text-xl); }
}

/* ═══ LARGER SCREENS (>480px) ════════════════════════ */
@media (min-width: 480px) {
  .settings-header { padding: 10px 18px; }

  .back-btn {
    left: 18px;
    width: 36px;
    height: 36px;
  }
  .back-btn svg { width: 20px; height: 20px; }

  .settings-title { font-size: var(--bb-text-xl); }

  .settings-body {
    gap: 20px;
    padding: 6px 20px 56px;
  }

  .settings-card {
    border-radius: 20px;
    padding: 0 20px;
  }

  .settings-row {
    gap: 13px;
    height: 58px;
  }

  .row-icon svg { width: 19px; height: 19px; }
  .row-label    { font-size: var(--bb-text-lg); }
  .row-chevron svg { width: 18px; height: 18px; }

  .premium-card        { height: 58px; }
  .premium-status      { font-size: var(--bb-text-sm); }

  .promo-banner {
    gap: 14px;
    padding: 18px 20px;
    border-radius: 20px;
  }
  .promo-copy   { gap: 5px; }
  .promo-title  { font-size: var(--bb-text-lg); }
  .promo-sub    { font-size: var(--bb-text-sm); }
  .promo-illustration { width: 46px; height: 46px; font-size: var(--bb-text-3xl); }
}
</style>