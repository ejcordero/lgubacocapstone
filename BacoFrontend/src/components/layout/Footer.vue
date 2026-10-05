<script setup>
import { site, footerNav, footerLegal, contactItems } from '../../config/site'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer">
    <div class="footer-main">
      <div>
        <RouterLink :to="{ name: 'home' }" class="f-brand">
          <div class="f-seal">
  <img src="/images/BACO-SEAL.png" alt="Baco Official Seal">
</div>
          <div>
            <div class="f-brand-name">{{ site.name }}</div>
            <div class="f-brand-sub">{{ site.subtitle }}</div>
          </div>
        </RouterLink>
        <p class="f-desc">Official website of the local government of Baco. </p>

        <div class="f-social">
          <a
            v-for="s in site.socials"
            :key="s.id"
            :href="s.href"
            class="f-soc"
            target="_blank"
            rel="noopener noreferrer"
            :title="s.label"
            :aria-label="s.label"
          ><i :class="s.icon"></i></a>
        </div>
      </div>

      <nav class="f-col" aria-label="Footer">
        <h4>Navigation</h4>
        <ul>
          <li v-for="link in footerNav" :key="link.label">
            <RouterLink :to="link.to">{{ link.label }}</RouterLink>
          </li>
        </ul>
      </nav>

      <div class="f-col">
        <h4>Contact Us</h4>
        <template v-for="item in contactItems" :key="item.icon">
          <a v-if="item.href" :href="item.href" class="f-ct f-ct-link">
            <i :class="item.icon"></i>{{ item.text }}
          </a>
          <div v-else class="f-ct"><i :class="item.icon"></i>{{ item.text }}</div>
        </template>
      </div>
    </div>

    <div class="footer-copy">
      <p>Copyright © {{ year }} {{ site.name }}. All Rights Reserved.</p>
      <div class="footer-copy-links">
        <RouterLink v-for="link in footerLegal" :key="link.label" :to="link.to">
          {{ link.label }}
        </RouterLink>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  background: #0b1d35;
  border-top: 4px solid #c0392b;
  margin-top: auto;
}

.footer-main {
  max-width: 1240px; margin: 0 auto; padding: 56px 32px;
  display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 56px;
}

.f-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; text-decoration: none; }

.f-seal {
  width: 52px; height: 52px; border-radius: 50%;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 700; color: white;
  flex-shrink: 0;
}

.f-brand-name {
  font-size: 0.88rem; font-weight: 700; color: white;
  text-transform: uppercase; letter-spacing: 0.06em;
}

.f-brand-sub { font-size: 0.68rem; color: rgba(255,255,255,0.42); margin-top: 2px; }

.f-desc { font-size: 0.79rem; color: rgba(255,255,255,0.42); line-height: 1.75; margin-bottom: 20px; }

.f-social { display: flex; gap: 9px; }

.f-soc {
  width: 33px; height: 33px; border-radius: 2px;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.55); display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; text-decoration: none;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.f-soc:hover { background: #c0392b; color: white; border-color: #c0392b; }

.f-col h4 {
  font-size: 0.66rem; font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: rgba(255,255,255,0.38);
  margin-bottom: 16px;
}

.f-col ul { list-style: none; display: flex; flex-direction: column; gap: 9px; }

.f-col ul a {
  font-size: 0.79rem; color: rgba(255,255,255,0.58);
  text-decoration: none; transition: color 0.2s;
}

.f-col ul a:hover { color: white; }

.f-ct {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.79rem; color: rgba(255,255,255,0.58);
  margin-bottom: 9px;
}

.f-ct i { color: #c0392b; width: 14px; }

.f-ct-link { text-decoration: none; transition: color 0.2s; }
.f-ct-link:hover { color: white; }

.footer-copy {
  background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.06);
  padding: 14px 32px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
}

.footer-copy p { font-size: 0.68rem; color: rgba(255,255,255,0.32); }

.footer-copy-links { display: flex; gap: 20px; }

.footer-copy-links a { font-size: 0.68rem; color: rgba(255,255,255,0.32); text-decoration: none; transition: color 0.2s; }

.footer-copy-links a:hover { color: rgba(255,255,255,0.65); }

.f-seal {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  overflow: hidden;
}

.f-seal img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  display: block;
}
@media (max-width: 1024px) {
  .footer-main { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 720px) {
  .footer-main { grid-template-columns: 1fr; padding: 40px 24px; gap: 32px; }
  .footer-copy { flex-direction: column; align-items: flex-start; padding: 14px 24px; }
}
</style>