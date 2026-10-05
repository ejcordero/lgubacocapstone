<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
  title:    { type: String, default: 'Comprehensive Public Services' },
  subtitle: { type: String, default: 'Municipality of Baco' }
})

const rootEl = ref(null)
let io = null

onMounted(() => {
  io = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('active'); io?.unobserve(e.target) }
    }),
    { threshold: 0.08 }
  )
  rootEl.value?.querySelectorAll('.reveal').forEach(el => io.observe(el))
})
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <section id="services" ref="rootEl" class="sv">

    <!-- ── Decorative shapes ── -->
    <div class="deco deco-ring-1" aria-hidden="true"></div>
    <div class="deco deco-blob-1" aria-hidden="true"></div>
    <div class="deco deco-ring-2" aria-hidden="true"></div>

    <div class="sv-inner">

      <!-- ── Header ── -->
      <div class="sv-header reveal">
        <p class="sv-eyebrow">{{ subtitle }}</p>
        <h2 class="sv-title">{{ title }}</h2>
      
      </div>

      <!-- ── Uniform card grid ── -->
      <div class="sv-grid">

        <div class="sc sc--navy reveal" style="--d:0.05s">
          <span class="sc-number" aria-hidden="true">01</span>
          <div class="sc-icon-wrap"><i class="fa-solid fa-hands-holding-child sc-icon"></i></div>
          <h3 class="sc-title">Social Welfare</h3>
          <p class="sc-text">Assistance for families, senior citizens, persons with disabilities, and vulnerable communities across all 27 barangays.</p>
        </div>

        <div class="sc sc--green reveal" style="--d:0.12s">
          <span class="sc-number" aria-hidden="true">02</span>
          <div class="sc-icon-wrap"><i class="fa-solid fa-kit-medical sc-icon"></i></div>
          <h3 class="sc-title">Health Services</h3>
          <p class="sc-text">Rural health unit schedules, vaccination drives, and outreach programs for all residents of Baco.</p>
        </div>

        <div class="sc sc--red reveal" style="--d:0.19s">
          <span class="sc-number" aria-hidden="true">03</span>
          <div class="sc-icon-wrap"><i class="fa-solid fa-file-signature sc-icon"></i></div>
          <h3 class="sc-title">Permits &amp; Licensing</h3>
          <p class="sc-text">Business permits, civil registry documents, and municipal licensing through the BPLO.</p>
        </div>

        <div class="sc sc--gold reveal" style="--d:0.26s">
          <span class="sc-number" aria-hidden="true">04</span>
          <div class="sc-icon-wrap"><i class="fa-solid fa-wheat-awn sc-icon"></i></div>
          <h3 class="sc-title">Agricultural Support</h3>
          <p class="sc-text">Technical assistance, seed distribution, and market linkages for farmers and cooperatives.</p>
        </div>

      </div>
    </div>
  </section>
</template>

<style scoped>
.sv {
  --navy:  #0B198F;
  --red:   #CE1126;
  --ease:  cubic-bezier(0.16, 1, 0.3, 1);

  position: relative;
  background: #ffffff;
  padding: 100px 0;
  overflow: hidden;
  z-index: 10;
}

/* ── Deco shapes ── */
.deco { position: absolute; pointer-events: none; z-index: 0; }

.deco-ring-1 {
  width: 280px; height: 280px;
  border: 10px solid rgba(11,25,143,0.07);
  border-radius: 50%;
  top: 40px; left: -80px;
}

.deco-blob-1 {
  width: 180px; height: 180px;
  background: rgba(206,17,38,0.06);
  border-radius: 50%;
  filter: blur(2px);
  bottom: 100px; right: 120px;
}

.deco-ring-2 {
  width: 140px; height: 140px;
  border: 5px dashed rgba(11,25,143,0.12);
  border-radius: 20px;
  transform: rotate(14deg);
  top: 50%; right: 40px;
}

.sv-inner {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* ── Header ── */
.sv-header { text-align: center; margin-bottom: 56px; }

.sv-eyebrow {
  font-family: 'Inter', sans-serif;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--red);
  margin: 0 0 14px;
}

.sv-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.9rem, 3.5vw, 2.8rem);
  font-weight: 900;
  color: var(--navy);
  letter-spacing: -0.025em;
  line-height: 1.12;
  margin: 0 0 18px;
}

.sv-desc {
  font-family: 'Inter', sans-serif;
  font-size: 0.97rem;
  line-height: 1.75;
  color: #5a6480;
  max-width: 580px;
  margin: 0 auto;
}

/* ── Grid — 4 equal cards ── */
.sv-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

/* ── Card (uniform) ── */
.sc {
  --ac:   var(--navy);
  --acbg: rgba(11,25,143,0.08);

  position: relative;
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.75);
  border-radius: 22px;
  padding: 30px 26px 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease), background 0.3s;
}

/* accent variants */
.sc--navy  { --ac: var(--navy);  --acbg: rgba(11,25,143,0.08); }
.sc--green { --ac: #0d7a3e;      --acbg: rgba(13,122,62,0.1); }
.sc--red   { --ac: var(--red);   --acbg: rgba(206,17,38,0.1); }
.sc--gold  { --ac: #9a7410;      --acbg: rgba(180,130,20,0.12); }

/* top accent bar — grows on hover */
.sc::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 44px; height: 4px;
  background: var(--ac);
  border-radius: 0 0 4px 0;
  transition: width 0.35s var(--ease);
}
.sc:hover::before { width: 100%; }

.sc:hover {
  background: rgba(255,255,255,0.85);
  transform: translateY(-6px);
  box-shadow: 0 18px 44px rgba(11,25,143,0.12);
}

.sc-number {
  position: absolute;
  top: 12px; right: 18px;
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 2.6rem;
  font-weight: 900;
  line-height: 1;
  color: rgba(15,22,40,0.06);
  pointer-events: none;
  user-select: none;
}

.sc-icon-wrap {
  width: 52px; height: 52px;
  border-radius: 14px;
  background: var(--acbg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.3s var(--ease), background 0.3s;
}
.sc:hover .sc-icon-wrap { transform: scale(1.08) rotate(-4deg); background: var(--ac); }
.sc:hover .sc-icon { color: #fff; }

.sc-icon {
  font-size: 1.2rem;
  color: var(--ac);
  transition: color 0.3s;
}

.sc-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.12rem;
  font-weight: 700;
  color: #0f1628;
  line-height: 1.3;
  margin: 4px 0 0;
}

.sc-text {
  font-family: 'Inter', sans-serif;
  font-size: 0.86rem;
  line-height: 1.7;
  color: #5a6480;
  margin: 0;
}

/* ── Reveal ── */
.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.75s var(--ease), transform 0.75s var(--ease);
  transition-delay: var(--d, 0s);
}
.reveal.active { opacity: 1; transform: none; }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .sv-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .sv { padding: 70px 0; }
  .sv-inner { padding: 0 1.25rem; }
  .sv-header { margin-bottom: 34px; }
  .sv-desc { font-size: 0.9rem; }
  .sv-grid { grid-template-columns: 1fr; gap: 0.85rem; }
  .sc { border-radius: 16px; padding: 20px 18px; gap: 10px; }
  .sc-number { font-size: 2rem; top: 8px; right: 12px; }
  .sc-icon-wrap { width: 42px; height: 42px; border-radius: 11px; }
  .sc-icon { font-size: 1rem; }
  .sc-title { font-size: 1rem; }
  .sc-text { font-size: 0.82rem; line-height: 1.6; }
}
</style>