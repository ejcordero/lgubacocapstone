import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function decodeJwt(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    return JSON.parse(atob(b64 + pad));
  } catch { return null; }
}

export const useOwnerStore = defineStore('owner', () => {
  // ── State ──
  const owner = ref(null);
  const token = ref('');
  const isAuthenticated = ref(false);
  const loading = ref(false);
  const error = ref(null);

  // ── Getters (same names as the mock) ──
  const fullName = computed(() => {
    if (!owner.value) return '';
    const parts = [
      owner.value.first_name ?? owner.value.firstName,
      owner.value.middle_name ?? owner.value.middleName,
      owner.value.last_name ?? owner.value.lastName
    ];
    return parts.filter(p => p).join(' ');
  });

  const initials = computed(() => {
    if (!owner.value) return '';
    const f = owner.value.first_name ?? owner.value.firstName;
    const l = owner.value.last_name ?? owner.value.lastName;
    return (f?.[0] || '') + (l?.[0] || '');
  });

  // Real backend statuses: 'active' | 'inactive'  (mock used verified/pending/suspended)
  const isVerified  = computed(() => owner.value?.status === 'active' || owner.value?.status === 'verified');
  const isPending   = computed(() => owner.value?.status === 'pending');
  const isSuspended = computed(() => owner.value?.status === 'inactive' || owner.value?.status === 'suspended');

  // ── Helpers ──
  // The backend returns camelCase; portal pages (OwnerHeader etc.) read
  // snake_case. Store BOTH spellings so nothing breaks either way.
  const normalizeOwner = (raw = {}) => {
    const o = { ...raw };
    const pairs = [
      ['firstName', 'first_name'], ['middleName', 'middle_name'], ['lastName', 'last_name'],
      ['contactNumber', 'contact_number'], ['businessName', 'business_name'],
      ['businessPermitNo', 'business_permit_no'],
    ];
    for (const [camel, snake] of pairs) {
      if (o[camel] !== undefined && o[snake] === undefined) o[snake] = o[camel];
      if (o[snake] !== undefined && o[camel] === undefined) o[camel] = o[snake];
    }
    if (!o.status) o.status = 'active';
    return o;
  };

  const persist = () => {
    localStorage.setItem('ownerToken', token.value);
    localStorage.setItem('ownerData', JSON.stringify(owner.value));
  };

  const clearSession = () => {
    localStorage.removeItem('ownerToken');
    localStorage.removeItem('ownerData');
    token.value = '';
    owner.value = null;
    isAuthenticated.value = false;
  };

  async function authedFetch(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: {
        // Never set Content-Type for FormData — the browser needs the boundary
        ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        Authorization: 'Bearer ' + token.value,
        ...(opts.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { status: res.status, data });
    return data;
  }

  // ── Actions (same names as the mock) ──
  const initialize = () => {
    const t = localStorage.getItem('ownerToken') || '';
    const ownerData = localStorage.getItem('ownerData');

    // Auto-heal: drop the old mock "mock-jwt-token-…" strings and any
    // expired/invalid token (real JWTs live 24h and carry role:'owner').
    if (!t || !t.startsWith('eyJ')) { clearSession(); return false; }
    const payload = decodeJwt(t);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now()) || payload.role !== 'owner') {
      clearSession();
      return false;
    }

    if (ownerData) {
      try { owner.value = JSON.parse(ownerData); } catch { owner.value = null; }
      token.value = t;
      isAuthenticated.value = true;
      return true;
    }
    clearSession();
    return false;
  };

  const login = async (email, password) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${API}/owner/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Backend also signals 403 with status:'pending' | 'rejected' for unapproved registrations
        error.value = data.message || 'Invalid email or password';
        loading.value = false;
        return { success: false, error: error.value, status: data.status || null };
      }

      token.value = data.token;
      owner.value = normalizeOwner(data.owner || {});

      // Enrich profile (contact number, permit no, hotels, cooldown dates…)
      try {
        const me = await authedFetch('/owner/auth/me');
        owner.value = normalizeOwner({ ...owner.value, ...me });
      } catch { /* login payload alone is enough */ }

      isAuthenticated.value = true;
      persist();
      loading.value = false;
      return { success: true, owner: owner.value };
    } catch (e) {
      error.value = 'Cannot reach the server. Is the backend running?';
      loading.value = false;
      return { success: false, error: error.value };
    }
  };

  const fetchProfile = async () => {
    const me = await authedFetch('/owner/auth/me');
    owner.value = normalizeOwner({ ...owner.value, ...me });
    persist();
    return owner.value;
  };

  // Real registration needs OTP first — call this from the signup form
  const sendOtp = async (email) => {
    const res = await fetch(`${API}/owner/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to send verification code.');
    return data;
  };

  const register = async (formData) => {
    loading.value = true;
    error.value = null;
    try {
      const fd = new FormData();

      // Text fields the backend expects, tolerant of common alternate names
      const alias = {
        firstName: ['firstName', 'first_name'], middleName: ['middleName', 'middle_name'],
        lastName: ['lastName', 'last_name'], email: ['email'],
        contactNumber: ['contactNumber', 'contact_number', 'phone'],
        password: ['password'], otp: ['otp', 'verificationCode', 'code'],
        businessName: ['businessName', 'business_name'], barangay: ['barangay'],
        businessAddress: ['businessAddress', 'business_address', 'address'],
        businessType: ['businessType', 'business_type'],
        businessPermitNo: ['businessPermitNo', 'business_permit_no'],
        businessContact: ['businessContact', 'business_contact'],
        businessEmail: ['businessEmail', 'business_email'],
      };
      const fileAlias = {
        validId: ['validId', 'valid_id', 'validIdFile', 'idFile'],
        businessPermit: ['businessPermit', 'business_permit', 'permitFile'],
        ownershipProof: ['ownershipProof', 'ownership_proof', 'proofFile'],
      };

      for (const [key, names] of Object.entries(alias)) {
        for (const n of names) {
          const v = formData?.[n];
          if (v !== undefined && v !== null && v !== '') { fd.append(key, String(v)); break; }
        }
      }
      for (const [key, names] of Object.entries(fileAlias)) {
        for (const n of names) {
          const v = formData?.[n];
          if (v instanceof File) { fd.append(key, v); break; }
        }
      }

      const res = await fetch(`${API}/owner/auth/register`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        error.value = data.message || 'Registration failed.';
        loading.value = false;
        return { success: false, error: error.value };
      }
      loading.value = false;
      return { success: true, message: data.message || 'Registration submitted! Awaiting LGU approval.' };
    } catch (e) {
      error.value = 'Cannot reach the server. Is the backend running?';
      loading.value = false;
      return { success: false, error: error.value };
    }
  };

  const logout = () => clearSession();

  const updateProfile = async (updates = {}) => {
    loading.value = true;
    error.value = null;
    try {
      const pick = (names) => { for (const n of names) if (updates[n] !== undefined) return updates[n]; return undefined; };
      const payload = {};
      const candidates = {
        firstName: ['firstName', 'first_name'],
        middleName: ['middleName', 'middle_name'],
        lastName: ['lastName', 'last_name'],
        contactNumber: ['contactNumber', 'contact_number', 'phone'],
        businessName: ['businessName', 'business_name'],
        businessPermitNo: ['businessPermitNo', 'business_permit_no'],
      };
      for (const [k, names] of Object.entries(candidates)) {
        const v = pick(names);
        if (v !== undefined) payload[k] = v;
      }

      if (Object.keys(payload).length) {
        await authedFetch('/owner/auth/profile', { method: 'PUT', body: JSON.stringify(payload) });
      }

      // Any extras the backend doesn't know (e.g. tin_number) still update locally
      owner.value = normalizeOwner({ ...owner.value, ...updates });
      persist();
      loading.value = false;
      return { success: true, message: 'Profile updated successfully' };
    } catch (e) {
      error.value = e.message;
      loading.value = false;
      return { success: false, error: e.message };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    loading.value = true;
    error.value = null;
    try {
      const data = await authedFetch('/owner/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      owner.value = normalizeOwner({ ...owner.value, password_changed_at: new Date().toISOString() });
      persist();
      loading.value = false;
      return { success: true, message: data.message || 'Password changed successfully' };
    } catch (e) {
      // Surfaces the password-policy message and the 7-day cooldown message
      error.value = e.message;
      loading.value = false;
      return { success: false, error: e.message };
    }
  };

  const uploadValidId = async (file) => {
    loading.value = true;
    error.value = null;
    try {
      const fd = new FormData();
      fd.append('validId', file);
      const data = await authedFetch('/owner/auth/valid-id', { method: 'PUT', body: fd });
      owner.value = normalizeOwner({ ...owner.value, validIdUrl: data.validIdUrl || owner.value.validIdUrl });
      persist();
      loading.value = false;
      return { success: true, path: data.validIdUrl || '', message: data.message || 'ID uploaded successfully' };
    } catch (e) {
      error.value = e.message;
      loading.value = false;
      return { success: false, error: e.message };
    }
  };

  return {
    // State
    owner, token, isAuthenticated, loading, error,
    // Getters
    fullName, initials, isVerified, isPending, isSuspended,
    // Actions
    initialize, login, register, logout, updateProfile, changePassword, uploadValidId,
    fetchProfile, sendOtp,
  };
});