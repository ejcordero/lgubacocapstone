<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MhoPanel from '../components/ui/MhoPanel.vue'
import MhoStatCard from '../components/ui/MhoStatCard.vue'
import { fetchContent } from '../composables/useMhoApi.js'

const router = useRouter()

const loading = ref(true)
const error = ref('')
const content = ref({ info: {}, services: [], googleForm: null })

const services = computed(() => content.value.services || [])

/* ── Derived read-outs ──
   These are counts of what is actually published, not invented metrics. An
   officer should be able to reconcile every number here against the Services
   page without leaving it. */
const stats = computed(() => {
  const list = services.value
  const detailed = list.filter((s) => (s.bullets || []).length > 0).length
  return {
    total: list.length,
    badges: (content.value.info?.badges || []).length,
    detailed,
    plain: list.length - detailed,
    hasForm: Boolean(content.value.googleForm?.url),
    hasFormImage: Boolean(content.value.googleForm?.image)
  }
})

/* Editorial gaps worth surfacing. Each maps to a concrete fix, so the card is
   a to-do list rather than a score. */
const gaps = computed(() => {
  const out = []
  if (!stats.value.hasForm) {
    out.push({
      tone: 'warn',
      icon: 'fa-triangle-exclamation',
      title: 'No announcement link',
      note: 'The public MHO page has no Google Form to send residents to.',
      action: 'Add one',
      to: '/mho-admin/announcement'
    })
  } else if (!stats.value.hasFormImage) {
    out.push({
      tone: 'info',
      icon: 'fa-image',
      title: 'Announcement has no image',
      note: 'The link works, but the card renders without its picture.',
      action: 'Upload one',
      to: '/mho-admin/announcement'
    })
  }
  if (stats.value.total === 0) {
    out.push({
      tone: 'danger',
      icon: 'fa-circle-exclamation',
      title: 'No services published',
      note: 'The public page is falling back to its built-in defaults.',
      action: 'Add a service',
      to: '/mho-admin/services'
    })
  }
  if (stats.value.badges === 0) {
    out.push({
      tone: 'info',
      icon: 'fa-tag',
      title: 'No hero badges',
      note: 'The hero renders without its quick-fact pills.',
      action: 'Add badges',
      to: '/mho-admin/content'
    })
  }
  return out
})

const recent = computed(() => services.value.slice(0, 5))

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    content.value = await fetchContent()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mho-admin__page">
    <header>
      <h1 class="mho-admin__title">MHO Dashboard</h1>
      <p class="mho-admin__subtitle">What the Municipal Health Office page is publishing right now.</p>
    </header>

    <div v-if="error" class="mho-alert mho-alert--danger">
      <i class="fa-solid fa-circle-exclamation"></i>
      <span>{{ error }}</span>
      <button type="button" @click="load">Retry</button>
    </div>

    <div class="mho-stats">
      <MhoStatCard
        label="Services" :value="stats.total" icon="fa-kit-medical" tone="accent"
        :hint="`${stats.detailed} with details · ${stats.plain} summary only`"
      />
      <MhoStatCard
        label="Hero Badges" :value="stats.badges" icon="fa-tag" tone="info"
        hint="Quick facts shown in the hero"
      />
      <MhoStatCard
        label="Announcement" :value="stats.hasForm ? 'Linked' : 'None'" icon="fa-bullhorn"
        :tone="stats.hasForm ? 'ok' : 'warn'"
        :hint="stats.hasFormImage ? 'Link and image set' : 'Image not set'"
      />
    </div>

    <div class="mho-split">
      <MhoPanel
        title="Editorial checklist"
        subtitle="Gaps on the live page"
        icon="fa-list-check"
      >
        <p v-if="loading" class="mho-muted">Checking…</p>
        <p v-else-if="gaps.length === 0" class="mho-clear">
          <i class="fa-solid fa-circle-check"></i>
          Nothing outstanding. The public page is fully populated.
        </p>
        <ul v-else class="mho-gaps">
          <li v-for="(g, i) in gaps" :key="i" :data-tone="g.tone">
            <i class="fa-solid" :class="g.icon"></i>
            <div class="mho-gaps__text">
              <strong>{{ g.title }}</strong>
              <span>{{ g.note }}</span>
            </div>
            <button type="button" @click="router.push(g.to)">{{ g.action }}</button>
          </li>
        </ul>
      </MhoPanel>

      <MhoPanel
        title="Services"
        subtitle="First five in published order"
        icon="fa-list"
        flush
      >
        <template #actions>
          <button class="mho-btn mho-btn--ghost" type="button" @click="router.push('/mho-admin/services')">
            Manage
          </button>
        </template>

        <p v-if="loading" class="mho-muted mho-pad">Loading…</p>
        <p v-else-if="recent.length === 0" class="mho-muted mho-pad">No services yet.</p>
        <ol v-else class="mho-mini-list">
          <li v-for="(s, i) in recent" :key="s.id">
            <span class="mho-mini-list__idx">{{ i + 1 }}</span>
            <span class="mho-mini-list__name">{{ s.name }}</span>
            <span class="mho-mini-list__count">
              {{ (s.bullets || []).length }} detail{{ (s.bullets || []).length === 1 ? '' : 's' }}
            </span>
          </li>
        </ol>
      </MhoPanel>
    </div>
  </div>
</template>

<style scoped>
.mho-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
}

.mho-split {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
  gap: 16px;
  align-items: start;
}

.mho-alert {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 16px;
  border-radius: var(--mho-radius);
  font-size: 0.85rem;
  font-weight: 500;
}
.mho-alert--danger {
  background: var(--mho-danger-soft);
  border: 1px solid var(--mho-danger);
  color: var(--mho-fg);
}
.mho-alert button {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--mho-fg);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.mho-muted { color: var(--mho-muted); font-size: 0.85rem; }
.mho-pad   { padding: 22px; margin: 0; }

.mho-clear {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 16px;
  border-radius: var(--mho-radius);
  background: var(--mho-ok-soft);
  color: var(--mho-ok);
  font-size: 0.86rem;
  font-weight: 600;
}

.mho-gaps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.mho-gaps li {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 14px 15px;
  border-radius: var(--mho-radius);
  background: var(--mho-surface-2);
  border: 1px solid var(--mho-border);
}
.mho-gaps li > i { font-size: 0.95rem; flex-shrink: 0; }
.mho-gaps li[data-tone='warn']   > i { color: var(--mho-warn); }
.mho-gaps li[data-tone='danger'] > i { color: var(--mho-danger); }
.mho-gaps li[data-tone='info']   > i { color: var(--mho-info); }
.mho-gaps__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.mho-gaps__text strong { font-size: 0.85rem; font-weight: 650; }
.mho-gaps__text span   { font-size: 0.78rem; color: var(--mho-muted); }
.mho-gaps li button {
  flex-shrink: 0;
  padding: 7px 13px;
  border-radius: var(--mho-radius-sm);
  border: 1px solid var(--mho-border-2);
  background: transparent;
  color: var(--mho-fg-2);
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--mho-ease);
}
.mho-gaps li button:hover { color: var(--mho-fg); border-color: var(--mho-border-3); background: var(--mho-surface-3); }

.mho-mini-list { list-style: none; margin: 0; padding: 6px 0; }
.mho-mini-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 22px;
}
.mho-mini-list li + li { border-top: 1px solid var(--mho-border); }
.mho-mini-list__idx {
  width: 22px; height: 22px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--mho-surface-3);
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--mho-muted);
}
.mho-mini-list__name {
  flex: 1;
  min-width: 0;
  font-size: 0.86rem;
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mho-mini-list__count { font-size: 0.74rem; color: var(--mho-muted); flex-shrink: 0; }

/* Canonical block, duplicated verbatim across the other three MHO views and
   mirrored in both Tourism views. This file previously had NO `display` at
   all, so its buttons were inline-block: an icon sat on the text baseline
   instead of being centred against the label, and the padding-derived height
   differed from every other view's. */
.mho-btn {
  /* Nothing in this project resets box-sizing, so a bare `height` would apply
     to the content box and the rendered height would still drift with padding.
     Declaring it here makes `height` mean what it looks like it means. */
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  /* 36px = .mho-top__ghost, so buttons align with the topbar controls. */
  height: 36px;
  padding: 0 16px;
  border-radius: var(--mho-radius-sm);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 650;
  /* 1, not inherited: :root sets 1.5, which made the content box height a
     function of font-size and knocked icons off the label's baseline. */
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s var(--mho-ease);
  white-space: nowrap;
}
.mho-btn--ghost {
  border: 1px solid var(--mho-border-2);
  background: transparent;
  color: var(--mho-fg-2);
}
.mho-btn--ghost:hover { color: var(--mho-fg); border-color: var(--mho-border-3); background: var(--mho-surface-3); }
</style>