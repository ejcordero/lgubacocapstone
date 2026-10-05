<script setup>
import { ref } from 'vue';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const error = ref('');
const errorKind = ref(''); // 'generic' | 'pending' | 'rejected'

const handleLogin = async () => {
  error.value = '';
  errorKind.value = '';

  if (!email.value.trim() || !password.value) {
    error.value = 'Please enter your email and password.';
    return;
  }

  loading.value = true;
  try {
    const r = await fetch(`${API}/owner/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim(), password: password.value })
    });
    const d = await r.json();

    if (r.ok) {
      // Success — store token + owner profile
      localStorage.setItem('baco_owner_token', d.token);
      localStorage.setItem('baco_owner_data', JSON.stringify(d.owner));
      window.location.href = '/owner';
      return;
    }

    // Backend status-aware errors
    if (r.status === 403 && d.status === 'pending') {
      errorKind.value = 'pending';
      error.value = d.message;
    } else if (r.status === 403 && d.status === 'rejected') {
      errorKind.value = 'rejected';
      error.value = d.message;
    } else {
      error.value = d.message || 'Invalid email or password.';
    }
  } catch {
    error.value = 'Network error. Please check your connection and try again.';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <!-- .ol-root is unique to this page. Every rule in style/ownerLogin.css is
       namespaced under it, so nothing here can style another page and nothing
       there can reach in. AdminLogin.vue also uses a .login-page root; that
       shared name is exactly what this prefix exists to prevent. -->
  <div class="ol-root ol-page">
    <!-- Page background. cover-tourism-img.jpg is the page, not the panel:
         blurred and knocked back so the card stays the focus. -->
    <div class="ol-bg" aria-hidden="true">
      <img class="ol-bg-photo" src="/images/cover-tourism-img.jpg" alt="" />
      <div class="ol-bg-scrim"></div>
    </div>

    <div class="ol-blob ol-blob-1"></div>
    <div class="ol-blob ol-blob-2"></div>
    <div class="ol-grain"></div>

    <div class="ol-card-shell">

      <!-- ═══ LEFT: photo showcase ═══ -->
      <aside class="ol-showcase">
        <img class="ol-photo" src="/images/MT-img.jpg" alt="Mt. Halcon, Baco" />

        <div class="ol-sc-top">
          <div class="ol-logo">
            <span class="ol-logo-mark"><img src="/images/BACO-TOURISM.png" alt="Baco Tourism" /></span>
            <div>
              <b>TURISMO</b>
              <span>Hotel Owner Portal</span>
            </div>
          </div>
          <span class="ol-badge"><i class="fas fa-shield-halved"></i> LGU Verified</span>
        </div>

        <!-- Decorative sample figures, as in the reference. -->
        <div class="ol-chip ol-glass ol-c1">
          <span class="ol-chip-icon"><i class="fas fa-arrow-trend-up"></i></span>
          <div><b>94%</b><span>Occupancy today</span></div>
        </div>
        <div class="ol-chip ol-glass ol-c2">
          <span class="ol-chip-icon"><i class="fas fa-calendar-check"></i></span>
          <div><b>27</b><span>New bookings</span></div>
        </div>
        <div class="ol-chip ol-glass ol-c3">
          <span class="ol-chip-icon"><span class="ol-live-dot"></span></span>
          <div><b>&#8369;184.2k</b><span>Revenue this week</span></div>
        </div>

        <div class="ol-sc-bottom">
          <span class="ol-sc-tag">Baco &middot; Oriental Mindoro</span>
          <h1 class="ol-sc-title">Your resort's numbers, <em>alive</em> in real time.</h1>
          <p class="ol-sc-sub">
            Track occupancy, revenue and guest bookings across every property
            &mdash; powered by the Municipality of Baco's tourism office.
          </p>
        </div>
      </aside>

      <!-- ═══ RIGHT: form ═══ -->
      <main class="ol-form-side">
        <div class="ol-mobile-head">
          <h2>Welcome <em>back</em></h2>
          <p>Sign in to manage your properties.</p>
        </div>

        <form class="ol-form" @submit.prevent="handleLogin">
          <h2 class="ol-title">Welcome <em>back</em></h2>
          <p class="ol-sub">Sign in to manage your properties.</p>

          <!-- Generic error -->
          <div v-if="error && errorKind === ''" class="ol-alert">
            <i class="fas fa-circle-exclamation"></i>
            {{ error }}
          </div>

          <!-- Pending review notice -->
          <div v-if="errorKind === 'pending'" class="ol-notice is-pending">
            <i class="fas fa-clock"></i>
            <div>
              <strong>Registration Under Review</strong>
              <p>{{ error }}</p>
            </div>
          </div>

          <!-- Rejected notice -->
          <div v-if="errorKind === 'rejected'" class="ol-notice is-rejected">
            <i class="fas fa-circle-xmark"></i>
            <div>
              <strong>Registration Not Approved</strong>
              <p>{{ error }}</p>
              <a href="/owner/register">Submit a new registration &rarr;</a>
            </div>
          </div>

          <div class="ol-group">
            <label for="ol-email">Email address</label>
            <div class="ol-input-wrap">
              <i class="fas fa-envelope"></i>
              <input id="ol-email" v-model="email" type="email" class="ol-input" autocomplete="email" />
            </div>
          </div>

          <div class="ol-group">
            <label for="ol-pass">Password</label>
            <div class="ol-input-wrap">
              <i class="fas fa-lock"></i>
              <input id="ol-pass" v-model="password" :type="showPassword ? 'text' : 'password'" class="ol-input" autocomplete="current-password" />
              <button type="button" class="ol-eye" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword">
                <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
              </button>
            </div>
          </div>

          <div class="ol-options">
            <label class="ol-check">
              <input type="checkbox" />
              <span></span>
              Remember me
            </label>
            <a class="ol-forgot" href="#">Forgot password?</a>
          </div>

          <button type="submit" class="ol-btn" :disabled="loading">
            <i v-if="loading" class="fas fa-spinner fa-spin"></i>
            <span v-else>Sign in</span>
          </button>

          <div class="ol-divider">or</div>

          <p class="ol-register">
            Don't have an account? <a href="/owner/register">Register your property</a>
          </p>
        </form>
      </main>
    </div>
  </div>
</template>


