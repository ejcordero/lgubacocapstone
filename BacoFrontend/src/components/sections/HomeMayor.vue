<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { API } from '@/api'

const props = defineProps({
  title:      { type: String, default: 'Message from the Mayor' },
  mayorName:  { type: String, default: 'Hon. Allan A. Roldan' },
  mayorTitle: { type: String, default: 'Municipal Mayor' },
  image:      { type: String, default: '/images/mayor-imgs.jpg' },
  message:    { type: String, default: 'Together, we are building a Baco that is socially just — where every citizen has access to quality services, education, and the opportunity to thrive.' },
  bodyText:   { type: String, default: 'Our administration remains steadfast in its commitment to transparent, accountable, and inclusive governance. Every decision is guided by the best interests of the people of Baco.' },
  isEditing:  { type: Boolean, default: false }
})

const rootEl = ref(null)
const live = ref(null)

const shown = computed(() => {
  const d = (props.isEditing || !live.value) ? null : live.value
  return {
    title:      d?.title      || props.title,
    mayorName:  d?.mayorName  || props.mayorName,
    mayorTitle: d?.mayorTitle || props.mayorTitle,
    image:      d?.image      || props.image,
    message:    d?.message    || props.message,
    bodyText:   d?.bodyText   || props.bodyText
  }
})

/* Last word of the title gets the italic accent */
const titleWords  = computed(() => String(shown.value.title || '').trim().split(/\s+/).filter(Boolean))
const titleLead   = computed(() => titleWords.value.length > 1 ? titleWords.value.slice(0, -1).join(' ') : (shown.value.title || ''))
const titleAccent = computed(() => titleWords.value.length ? titleWords.value[titleWords.value.length - 1] : '')

const numberFmt = new Intl.NumberFormat('en-US')
const fmt = (n) => Number.isFinite(Number(n)) ? numberFmt.format(Number(n)) : '—'

async function load () {
  try {
    const res = await fetch(`${API}/mayor-message`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return
    const d = await res.json()
    if (d && typeof d === 'object') live.value = d
  } catch { /* backend down → props defaults stay */ }
}

let io = null
onMounted(() => {
  io = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('active'); io?.unobserve(e.target) }
    }),
    { threshold: 0.08 }
  )
  rootEl.value?.querySelectorAll('.reveal').forEach(el => io.observe(el))
  if (!props.isEditing) load()
})
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <section id="government" ref="rootEl" class="ms">
    <div v-if="isEditing" class="editor-mode-badge">👤 Mayor's Message</div>

    <!-- ── Decorative layer ── -->
    <div class="d d-blob1" aria-hidden="true"></div>
    <div class="d d-blob2" aria-hidden="true"></div>
    <div class="d d-ring" aria-hidden="true"></div>
    <div class="d d-dots" aria-hidden="true"></div>
    <div class="d d-dot d-dot-a" aria-hidden="true"></div>
    <div class="d d-dot d-dot-b" aria-hidden="true"></div>

    <div class="ms-inner">

      <!-- ── Eyebrow ── -->
      <div class="ms-label reveal">
        <span class="ms-line" aria-hidden="true"></span>
        <span class="ms-eyebrow">Executive Desk</span>
      </div>

      <div class="ms-grid">

        <!-- ── Photo column ── -->
        <div class="ms-figure reveal" style="--d:.08s">
          <div class="ms-frame" aria-hidden="true"></div>
          <div class="ms-photo-wrap">
            <img class="ms-photo" :src="shown.image" :alt="shown.mayorName" loading="lazy" />
          </div>
          <div class="ms-idcard">
            <strong class="ms-name">{{ shown.mayorName }}</strong>
            <span class="ms-pos">{{ shown.mayorTitle }}</span>
          </div>
        </div>

        <!-- ── Content column ── -->
        <div class="ms-content">

          <h2 class="ms-title reveal" style="--d:.14s">
            {{ titleLead }} <em>{{ titleAccent }}</em>
          </h2>

          <p v-if="shown.message" class="ms-lead reveal" style="--d:.2s">{{ shown.message }}</p>

          <p v-if="shown.bodyText" class="ms-body reveal" style="--d:.26s">{{ shown.bodyText }}</p>

          <div class="ms-sign reveal" style="--d:.32s">
            <span class="ms-sign-line" aria-hidden="true"></span>
            <div class="ms-sign-txt">
              <span class="ms-sign-name">{{ shown.mayorName }}</span>
              <span class="ms-sign-pos">{{ shown.mayorTitle }}</span>
            </div>
          </div>

       

        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ms {
  --navy: #0B198F;
  --red:  #CE1126;
  --ink:  #0f1628;
  --muted:#5a6480;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);

  position: relative;
  background:
    radial-gradient(900px 500px at 88% -5%, rgba(11,25,143,0.045), transparent 60%),
    radial-gradient(700px 420px at -8% 105%, rgba(206,17,38,0.035), transparent 60%),
    #ffffff;
  padding: 110px 0;
  overflow: hidden;
  z-index: 10;
}

/* ── Decorative layer ── */
.d { position: absolute; pointer-events: none; z-index: 0; }

.d-blob1 {
  width: 560px; height: 560px;
  background: radial-gradient(circle, rgba(11,25,143,0.06) 0%, transparent 70%);
  border-radius: 50%;
  top: -140px; right: -160px;
}
.d-blob2 {
  width: 420px; height: 420px;
  background: radial-gradient(circle, rgba(206,17,38,0.05) 0%, transparent 70%);
  border-radius: 50%;
  bottom: -130px; left: -150px;
}
.d-ring {
  width: 150px; height: 150px;
  border: 2px dashed rgba(11,25,143,0.16);
  border-radius: 50%;
  top: 70px; left: 46%;
  animation: ms-float 9s ease-in-out infinite;
}
.d-dots {
  width: 130px; height: 130px;
  background-image: radial-gradient(circle, rgba(11,25,143,0.20) 1.5px, transparent 1.5px);
  background-size: 18px 18px;
  bottom: 90px; right: 6%;
  animation: ms-float 7s ease-in-out infinite reverse;
}
.d-dot { border-radius: 50%; }
.d-dot-a {
  width: 9px; height: 9px;
  background: rgba(206,17,38,0.4);
  top: 34%; left: 4%;
  animation: ms-float 6s ease-in-out infinite;
}
.d-dot-b {
  width: 14px; height: 14px;
  background: rgba(11,25,143,0.18);
  bottom: 22%; right: 38%;
  animation: ms-float 8s ease-in-out infinite reverse;
}

@keyframes ms-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-14px); }
}

.ms-inner {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* ── Eyebrow ── */
.ms-label { display: flex; align-items: center; gap: 14px; margin-bottom: 44px; }
.ms-line {
  width: 34px; height: 2px;
  background: var(--red);
  border-radius: 2px;
}
.ms-eyebrow {
  font-family: 'Inter', sans-serif;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--red);
}

/* ── Grid ── */
.ms-grid {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 72px;
  align-items: start;
}

/* ── Photo figure ── */
.ms-figure { position: relative; }

.ms-frame {
  position: absolute;
  inset: 22px -20px -20px 22px;
  background: linear-gradient(135deg, rgba(11,25,143,0.14) 0%, rgba(206,17,38,0.14) 100%);
  border-radius: 30px;
  z-index: 0;
}

.ms-photo-wrap {
  position: relative;
  z-index: 1;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 18px 56px rgba(11,25,143,0.16);
  background: #e9edf7;
}

.ms-photo {
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  object-position: top center;
  display: block;
  filter: saturate(0.94);
  transition: transform 0.7s var(--ease), filter 0.4s;
}
.ms-photo-wrap:hover .ms-photo { transform: scale(1.045); filter: saturate(1.05); }

.ms-idcard {
  position: absolute;
  z-index: 2;
  left: 18px; right: 18px; bottom: 18px;
  background: rgba(255,255,255,0.86);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255,255,255,0.7);
  border-radius: 16px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 10px 30px rgba(11,25,143,0.14);
  transition: transform 0.35s var(--ease);
}
.ms-figure:hover .ms-idcard { transform: translateY(-4px); }

.ms-name {
  font-family: 'Playfair Display', serif;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--navy);
  line-height: 1.2;
}
.ms-pos {
  font-family: 'Inter', sans-serif;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--red);
}

/* ── Content ── */
.ms-content { padding-top: 6px; }

.ms-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.9rem, 3vw, 2.7rem);
  font-weight: 900;
  color: var(--navy);
  line-height: 1.1;
  letter-spacing: -0.025em;
  margin: 0 0 30px;
}
.ms-title em { font-style: italic; color: var(--red); }

/* Full message — large serif lead with oversized quote glyph */
.ms-lead {
  position: relative;
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.08rem, 1.5vw, 1.28rem);
  font-weight: 600;
  line-height: 1.75;
  color: var(--ink);
  white-space: pre-line;
  margin: 0 0 22px;
  padding-left: 44px;
}
.ms-lead::before {
  content: '\201C';
  position: absolute;
  top: -26px; left: -6px;
  font-family: 'Playfair Display', serif;
  font-size: 5.2rem;
  font-weight: 900;
  line-height: 1;
  color: rgba(206,17,38,0.16);
  user-select: none;
}

.ms-body {
  font-family: 'Inter', sans-serif;
  font-size: 0.95rem;
  line-height: 1.85;
  color: var(--muted);
  white-space: pre-line;
  margin: 0 0 34px;
  padding-left: 44px;
}

/* ── Letter-style signature ── */
.ms-sign {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 0 30px;
  padding-left: 44px;
}
.ms-sign-line {
  width: 44px; height: 2px;
  background: var(--red);
  border-radius: 2px;
  flex-shrink: 0;
}
.ms-sign-txt { display: flex; flex-direction: column; gap: 2px; }
.ms-sign-name {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--navy);
  line-height: 1.1;
}
.ms-sign-pos {
  font-family: 'Inter', sans-serif;
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #9aa0b8;
}

/* ── Stat chips ── */
.ms-meta {
  display: flex;
  align-items: center;
  gap: 26px;
  padding: 22px 26px;
  border: 1px solid rgba(11,25,143,0.09);
  border-radius: 18px;
  background: rgba(11,25,143,0.025);
  width: fit-content;
  max-width: 100%;
}
.ms-stat { display: flex; align-items: center; gap: 12px; }
.ms-stat-ic {
  width: 42px; height: 42px;
  background: rgba(11,25,143,0.08);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  color: var(--navy);
  flex-shrink: 0;
}
.ms-stat-txt { display: flex; flex-direction: column; gap: 1px; }
.ms-stat-val {
  font-family: 'Playfair Display', serif;
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--navy);
  line-height: 1;
}
.ms-stat-lb {
  font-family: 'Inter', sans-serif;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #9aa0b8;
}
.ms-sep { width: 1px; height: 38px; background: rgba(11,25,143,0.12); }

/* ── Reveal ── */
.reveal {
  opacity: 0;
  transform: translateY(26px);
  transition: opacity 0.75s var(--ease), transform 0.75s var(--ease);
  transition-delay: var(--d, 0s);
}
.reveal.active { opacity: 1; transform: none; }

/* Editor badge (admin canvas only) */
.editor-mode-badge {
  position: absolute;
  top: 20px; left: 20px;
  background: rgba(15, 23, 42, 0.85);
  color: #38bdf8;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  z-index: 50;
  pointer-events: none;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(56, 189, 248, 0.3);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* ── Responsive ── */
@media (max-width: 960px) {
  .ms { padding: 80px 0; }
  .ms-grid { grid-template-columns: 1fr; gap: 56px; }
  .ms-figure { max-width: 420px; margin: 0 auto; width: 100%; }
  .ms-frame { inset: 16px -14px -14px 16px; }
  .ms-content { padding-top: 0; }
  .ms-lead, .ms-body, .ms-sign { padding-left: 0; }
  .ms-lead::before { position: static; display: block; margin-bottom: 4px; }
}

@media (max-width: 540px) {
  .ms { padding: 64px 0; }
  .ms-inner { padding: 0 1.25rem; }
  .ms-label { margin-bottom: 32px; }
  .ms-title { margin-bottom: 24px; }
  .ms-meta { flex-wrap: wrap; gap: 16px; padding: 18px 20px; }
  .ms-sep { display: none; }
  .ms-idcard { left: 12px; right: 12px; bottom: 12px; padding: 12px 14px; }
  .d-ring, .d-dots { display: none; }
}
</style>