<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';

// ── Config ──────────────────────────────────────────────────────────
// TOKEN_KEY must match the key written by OwnerLogin.vue
// (confirmed: OwnerSidebar.vue reads 'baco_owner_token')
const API_BASE = 'http://localhost:3000/api';
const TOKEN_KEY = 'baco_owner_token';
const DATA_KEY = 'baco_owner_data';

// ⚠️ Keep in sync with web.js: PASSWORD_MIN_LENGTH + validatePasswordPolicy
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_COOLDOWN_DAYS = 7;

const router = useRouter();

// ── Password Policy (client mirror of backend rules) ────────────────
const passwordRules = [
  { key: 'length',  label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: v => v.length >= PASSWORD_MIN_LENGTH },
  { key: 'upper',   label: 'One uppercase letter (A–Z)',                 test: v => /[A-Z]/.test(v) },
  { key: 'lower',   label: 'One lowercase letter (a–z)',                 test: v => /[a-z]/.test(v) },
  { key: 'number',  label: 'One number (0–9)',                           test: v => /[0-9]/.test(v) },
  { key: 'special', label: 'One special character (!@#$%&*)',            test: v => /[^A-Za-z0-9\s]/.test(v) },
  { key: 'nospace', label: 'No spaces',                                  test: v => !/\s/.test(v) },
];

// ── State ───────────────────────────────────────────────────────────
const loading = ref(true);
const loadError = ref('');
const profile = ref(null); // server copy (email, id, status, validIdUrl, createdAt, cooldown fields)

const personal = reactive({ firstName: '', middleName: '', lastName: '', contactNumber: '' });
const business = reactive({ businessName: '', businessPermitNo: '' });
const original = reactive({ firstName: '', middleName: '', lastName: '', contactNumber: '', businessName: '', businessPermitNo: '' });

const savingPersonal = ref(false);
const savingBusiness = ref(false);

// Valid ID upload
const idInput = ref(null);
const uploadingId = ref(false);

// Password change
const showPasswordForm = ref(false);
const changingPassword = ref(false);
const passwordForm = reactive({ current: '', next: '', confirm: '' });
const passwordError = ref('');
const showCurrent = ref(false);
const showNext = ref(false);
const showConfirm = ref(false);

// Toast
const toast = reactive({ show: false, message: '', type: 'success' });
let toastTimer = null;
const showToast = (message, type = 'success') => {
  toast.show = true;
  toast.message = message;
  toast.type = type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.show = false), 3500);
};

// ── Confirmation Modal (promise-based — can be awaited anywhere) ────
const confirmModal = reactive({
  show: false,
  title: '',
  message: '',
  changes: [],       // [{ label, old, new }]
  confirmText: 'Yes, continue',
  cancelText: 'Cancel',
  tone: 'primary',   // 'primary' | 'danger'
  resolve: null,
});

const openConfirm = (options) => {
  return new Promise((resolve) => {
    confirmModal.show = true;
    confirmModal.title = options.title || 'Are you sure?';
    confirmModal.message = options.message || '';
    confirmModal.changes = options.changes || [];
    confirmModal.confirmText = options.confirmText || 'Yes, continue';
    confirmModal.cancelText = options.cancelText || 'Cancel';
    confirmModal.tone = options.tone || 'primary';
    confirmModal.resolve = resolve;
  });
};

const resolveConfirm = (value) => {
  confirmModal.show = false;
  if (confirmModal.resolve) { confirmModal.resolve(value); confirmModal.resolve = null; }
};
const confirmAction = () => resolveConfirm(true);
const cancelConfirm = () => resolveConfirm(false);

// Esc key cancels the modal
const onKeydown = (e) => { if (e.key === 'Escape' && confirmModal.show) cancelConfirm(); };
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

// ── Auth helpers ────────────────────────────────────────────────────
const authHeaders = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
};

const handleAuthError = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(DATA_KEY);
  router.push('/owner/login');
};

// Keeps the sidebar identity (OwnerSidebar reads this on mount) in sync
const syncOwnerData = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
    const merged = {
      ...stored,
      firstName: personal.firstName,
      lastName: personal.lastName,
      businessName: business.businessName
    };
    localStorage.setItem(DATA_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event('baco-owner-updated'));
  } catch (e) { /* non-critical */ }
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ── Computeds ───────────────────────────────────────────────────────
const passwordRulesWithDiff = computed(() => [
  ...passwordRules.map(r => ({ ...r, passed: r.test(passwordForm.next) })),
  {
    key: 'different',
    label: 'Different from current password',
    // While the "current" field is still empty, don't fail this rule yet
    passed: !passwordForm.current || passwordForm.next !== passwordForm.current,
  }
]);

const passedCoreCount = computed(() => passwordRules.filter(r => r.test(passwordForm.next)).length);
const allRulesPassed = computed(() =>
  passedCoreCount.value === passwordRules.length &&
  (!passwordForm.current || passwordForm.next !== passwordForm.current)
);

// Strength meter (based on the 6 core policy rules)
// Green scale — light green → deep green (never reads as "failed")
const strengthPercent = computed(() => Math.round((passedCoreCount.value / passwordRules.length) * 100));
const strengthMeta = computed(() => {
  const n = passedCoreCount.value;
  if (n <= 1) return { label: 'Getting Started', cls: 's-1' };
  if (n === 2) return { label: 'Fair',           cls: 's-2' };
  if (n === 3) return { label: 'Decent',         cls: 's-3' };
  if (n === 4) return { label: 'Good',           cls: 's-4' };
  if (n === 5) return { label: 'Strong',         cls: 's-5' };
  return { label: 'Very Strong', cls: 's-6' };
});

const initials = computed(() => {
  const f = (personal.firstName || '').charAt(0);
  const l = (personal.lastName || '').charAt(0);
  return `${f}${l}`.toUpperCase() || 'OW';
});

const ownerRef = computed(() =>
  profile.value ? `#OWN-${String(profile.value.id).padStart(4, '0')}` : '—'
);

const isActive = computed(() => profile.value?.status === 'active');

const idFileName = computed(() => {
  if (!profile.value?.validIdUrl) return null;
  return decodeURIComponent(profile.value.validIdUrl.split('/').pop());
});

const idIsPdf = computed(() => (idFileName.value || '').toLowerCase().endsWith('.pdf'));

const isPersonalDirty = computed(() =>
  personal.firstName !== original.firstName ||
  personal.middleName !== original.middleName ||
  personal.lastName !== original.lastName ||
  personal.contactNumber !== original.contactNumber
);

const isBusinessDirty = computed(() =>
  business.businessName !== original.businessName ||
  business.businessPermitNo !== original.businessPermitNo
);

const hasUnsavedChanges = computed(() => isPersonalDirty.value || isBusinessDirty.value);

const passwordsMatch = computed(() =>
  passwordForm.next.length > 0 && passwordForm.next === passwordForm.confirm
);

// Mismatch diagnostic: tells the user WHY they don't match
const mismatchHint = computed(() => {
  if (passwordsMatch.value || !passwordForm.next || !passwordForm.confirm) return '';
  const n = passwordForm.next.length, c = passwordForm.confirm.length;
  if (n !== c) return `(new: ${n} characters · confirm: ${c} characters — check for missing or extra characters)`;
  return `(same length — check for auto-capitalization or a different character. Use the eye icons to reveal and compare.)`;
});

const passwordSubmitReady = computed(() =>
  passwordForm.current.length > 0 &&
  allRulesPassed.value &&
  passwordsMatch.value
);

// ── 7-day password change cooldown ──────────────────────────────────
const passwordCooldownUntil = computed(() => {
  const next = profile.value?.passwordChangeAvailableAt;
  if (!next) return null;
  const t = new Date(next).getTime();
  return Date.now() < t ? new Date(t) : null;
});
const canChangePassword = computed(() => !passwordCooldownUntil.value);
const cooldownDateLabel = computed(() =>
  passwordCooldownUntil.value
    ? passwordCooldownUntil.value.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''
);
const cooldownDaysLeft = computed(() => {
  if (!passwordCooldownUntil.value) return 0;
  return Math.max(1, Math.ceil((passwordCooldownUntil.value.getTime() - Date.now()) / 86400000));
});

// ── Diff builders (show old → new in the confirm dialog) ────────────
const buildPersonalDiff = () => {
  const fields = [
    { key: 'firstName', label: 'First Name' },
    { key: 'middleName', label: 'Middle Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'contactNumber', label: 'Contact Number' },
  ];
  return fields
    .filter(f => personal[f.key] !== original[f.key])
    .map(f => ({ label: f.label, old: original[f.key] || '(empty)', new: personal[f.key] }));
};

const buildBusinessDiff = () => {
  const fields = [
    { key: 'businessName', label: 'Business Name' },
    { key: 'businessPermitNo', label: 'Business Permit No.' },
  ];
  return fields
    .filter(f => business[f.key] !== original[f.key])
    .map(f => ({ label: f.label, old: original[f.key] || '(empty)', new: business[f.key] }));
};

// ── Load profile ────────────────────────────────────────────────────
const loadProfile = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    const headers = authHeaders();
    if (!headers) return handleAuthError();

    const res = await fetch(`${API_BASE}/owner/auth/me`, { headers });
    if (res.status === 401 || res.status === 403) return handleAuthError();
    if (!res.ok) throw new Error('Failed to load your profile.');

    profile.value = await res.json();
    const p = profile.value;

    personal.firstName = p.firstName || '';
    personal.middleName = p.middleName || '';
    personal.lastName = p.lastName || '';
    personal.contactNumber = p.contactNumber || '';
    business.businessName = p.businessName || '';
    business.businessPermitNo = p.businessPermitNo || '';
    Object.assign(original, { ...personal, ...business });

    syncOwnerData();
  } catch (e) {
    loadError.value = e.message || 'Something went wrong.';
  } finally {
    loading.value = false;
  }
};

// ── Save personal info (with confirmation) ──────────────────────────
const savePersonal = async () => {
  if (!personal.firstName.trim()) return showToast('First name is required.', 'error');
  if (!personal.lastName.trim()) return showToast('Last name is required.', 'error');
  if (!personal.contactNumber.trim()) return showToast('Contact number is required.', 'error');
  if (!/^[0-9+\-\s()]{7,20}$/.test(personal.contactNumber.trim())) {
    return showToast('Enter a valid contact number (e.g., 0917 123 4567).', 'error');
  }

  const changes = buildPersonalDiff();
  const confirmed = await openConfirm({
    title: 'Save Changes?',
    message: 'Are you sure you want to change your personal information?',
    changes,
    confirmText: 'Yes, Save Changes',
  });
  if (!confirmed) return;

  savingPersonal.value = true;
  try {
    const res = await fetch(`${API_BASE}/owner/auth/profile`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: personal.firstName,
        middleName: personal.middleName,
        lastName: personal.lastName,
        contactNumber: personal.contactNumber
      })
    });
    if (res.status === 401 || res.status === 403) return handleAuthError();
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save.');

    Object.assign(original, {
      firstName: personal.firstName,
      middleName: personal.middleName,
      lastName: personal.lastName,
      contactNumber: personal.contactNumber
    });
    syncOwnerData();
    showToast(data.message || 'Personal info saved.');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    savingPersonal.value = false;
  }
};

// ── Save business info (with confirmation) ──────────────────────────
const saveBusiness = async () => {
  if (!business.businessName.trim()) return showToast('Business name is required.', 'error');

  const changes = buildBusinessDiff();
  const confirmed = await openConfirm({
    title: 'Save Changes?',
    message: 'Are you sure you want to change your business information?',
    changes,
    confirmText: 'Yes, Save Changes',
  });
  if (!confirmed) return;

  savingBusiness.value = true;
  try {
    const res = await fetch(`${API_BASE}/owner/auth/profile`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: business.businessName,
        businessPermitNo: business.businessPermitNo
      })
    });
    if (res.status === 401 || res.status === 403) return handleAuthError();
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save.');

    original.businessName = business.businessName;
    original.businessPermitNo = business.businessPermitNo;
    syncOwnerData();
    showToast(data.message || 'Business info saved.');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    savingBusiness.value = false;
  }
};

// ── Valid ID: replace (confirmation BEFORE opening the picker) ──────
const triggerIdUpload = async () => {
  const confirmed = await openConfirm({
    title: profile.value?.validIdUrl ? 'Replace Valid ID?' : 'Upload Valid ID?',
    message: profile.value?.validIdUrl
      ? 'Your current Valid Government ID on file will be permanently replaced with the new one you select.'
      : 'You will select a valid government ID (PDF, JPG, or PNG, max 5MB) to attach to your account.',
    confirmText: 'Yes, Continue',
  });
  if (confirmed) idInput.value?.click();
};

const handleIdUpload = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = ''; // reset so the same file can be re-selected
  if (!file) return;

  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowed.includes(file.type)) return showToast('Only PDF, JPG, and PNG files are allowed.', 'error');
  if (file.size > 5 * 1024 * 1024) return showToast('File is too large. Maximum size is 5MB.', 'error');

  uploadingId.value = true;
  try {
    const fd = new FormData();
    fd.append('validId', file);
    const res = await fetch(`${API_BASE}/owner/auth/valid-id`, {
      method: 'PUT',
      headers: authHeaders(), // no Content-Type — browser sets the multipart boundary
      body: fd
    });
    if (res.status === 401 || res.status === 403) return handleAuthError();
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload.');

    profile.value.validIdUrl = data.validIdUrl;
    showToast(data.message || 'Valid ID updated.');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    uploadingId.value = false;
  }
};

// ── Change password (policy + confirmation + 7-day cooldown) ────────
const togglePasswordForm = () => {
  showPasswordForm.value = !showPasswordForm.value;
  passwordError.value = '';
  Object.assign(passwordForm, { current: '', next: '', confirm: '' });
  showCurrent.value = showNext.value = showConfirm.value = false;
};

const changePassword = async () => {
  passwordError.value = '';
  if (!passwordForm.current) { passwordError.value = 'Enter your current password.'; return; }
  if (!allRulesPassed.value) { passwordError.value = 'Your new password does not meet all the security requirements yet.'; return; }
  if (!passwordsMatch.value) { passwordError.value = 'New passwords do not match. ' + mismatchHint.value; return; }
  if (passwordForm.next === passwordForm.current) { passwordError.value = 'New password must be different from your current password.'; return; }

  const confirmed = await openConfirm({
    title: 'Change Password?',
    message: `Are you sure you want to change your password? For security, passwords can only be changed once every ${PASSWORD_COOLDOWN_DAYS} days.`,
    confirmText: 'Yes, Change Password',
  });
  if (!confirmed) return;

  changingPassword.value = true;
  try {
    const res = await fetch(`${API_BASE}/owner/auth/password`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.next })
    });
    const data = await res.json().catch(() => ({}));

    // Only redirect on a real token failure — a wrong "current password"
    // also returns 401 but must stay inline.
    if ((res.status === 401 || res.status === 403) && /token/i.test(data.message || '')) {
      return handleAuthError();
    }

    // Cooldown hit — server is the source of truth (e.g., changed on another device)
    if (res.status === 429) {
      passwordError.value = data.message || `Password changes are limited to once every ${PASSWORD_COOLDOWN_DAYS} days.`;
      if (data.nextAllowedAt) profile.value.passwordChangeAvailableAt = data.nextAllowedAt;
      return;
    }

    if (!res.ok) { passwordError.value = data.message || 'Failed to change password.'; return; }

    // Sync local cooldown state so the UI locks immediately
    const now = new Date();
    profile.value.passwordChangedAt = now.toISOString();
    profile.value.passwordChangeAvailableAt = new Date(now.getTime() + PASSWORD_COOLDOWN_DAYS * 86400000).toISOString();

    togglePasswordForm();
    showToast(data.message || 'Password changed successfully.');
  } catch (e) {
    passwordError.value = e.message || 'Something went wrong.';
  } finally {
    changingPassword.value = false;
  }
};

// ── Unsaved-changes guard on navigation ─────────────────────────────
onBeforeRouteLeave(async () => {
  if (!hasUnsavedChanges.value) return true;
  return await openConfirm({
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.',
    confirmText: 'Leave Page',
    tone: 'danger',
  });
});

onMounted(loadProfile);
</script>

<template>
  <div class="owner-profile">
    <div class="page-title">
      <div>
        <h1>My <span>Profile</span></h1>
        <p>Manage your owner account and business details.</p>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>Loading your profile…</p>
    </div>

    <!-- Error state -->
    <div v-else-if="loadError" class="state-box error">
      <i class="fas fa-triangle-exclamation"></i>
      <p>{{ loadError }}</p>
      <button class="btn-secondary" @click="loadProfile"><i class="fas fa-rotate-right"></i>Retry</button>
    </div>

    <template v-else-if="profile">
      <!-- ══════════ Personal Information ══════════ -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-user-circle" style="color:var(--ac)"></i>Personal Information</h3>
        </div>
        <div class="card-body">
          <div class="profile-summary">
            <div class="avatar">
              {{ initials }}
              <div class="status-dot" :class="{ inactive: !isActive }" :title="isActive ? 'Active' : 'Inactive'"></div>
            </div>
            <div class="profile-info">
              <h2>{{ personal.firstName }} {{ personal.lastName }}</h2>
              <div class="business">{{ business.businessName || 'No business name set' }}</div>
              <div class="email"><i class="fas fa-envelope"></i>{{ profile.email }}</div>
              <div class="meta-row">
                <span class="badge" :class="isActive ? 'ok' : 'muted'">{{ isActive ? 'Active' : 'Inactive' }}</span>
                <span class="meta-text">Member since {{ formatDate(profile.createdAt) }}</span>
              </div>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>First Name</label>
              <input v-model="personal.firstName" type="text" maxlength="100" />
            </div>
            <div class="form-group">
              <label>Middle Name <span class="optional">(optional)</span></label>
              <input v-model="personal.middleName" type="text" maxlength="100" />
            </div>
            <div class="form-group">
              <label>Last Name</label>
              <input v-model="personal.lastName" type="text" maxlength="100" />
            </div>
            <div class="form-group">
              <label>Contact Number</label>
              <input v-model="personal.contactNumber" type="tel" maxlength="20" placeholder="0917 123 4567" />
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input :value="profile.email" type="email" disabled class="disabled-input" />
              <small class="field-note"><i class="fas fa-lock"></i>Used to log in — contact the LGU Tourism Office to change it.</small>
            </div>
            <div class="form-group">
              <label>Owner ID</label>
              <input :value="ownerRef" type="text" disabled class="disabled-input" />
            </div>
          </div>
          <div class="form-actions">
            <span v-if="isPersonalDirty" class="dirty-hint"><i class="fas fa-pen"></i>Unsaved changes</span>
            <button class="btn-primary" :disabled="!isPersonalDirty || savingPersonal" @click="savePersonal">
              <i class="fas" :class="savingPersonal ? 'fa-spinner fa-spin' : 'fa-save'"></i>
              {{ savingPersonal ? 'Saving…' : 'Save Personal Info' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ══════════ Business Information ══════════ -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-building" style="color:var(--ok)"></i>Business Information</h3>
        </div>
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group full">
              <label>Business Name</label>
              <input v-model="business.businessName" type="text" maxlength="255" />
            </div>
            <div class="form-group">
              <label>Business Permit No.</label>
              <input v-model="business.businessPermitNo" type="text" maxlength="100" />
            </div>
            <div class="form-group">
              <label>Registered Email</label>
              <input :value="profile.email" type="email" disabled class="disabled-input" />
            </div>
            <div class="form-group full">
              <label>Valid Government ID</label>
              <div v-if="profile.validIdUrl" class="file-attachment">
                <div class="file-icon" :class="{ img: !idIsPdf }">
                  <i class="fas" :class="idIsPdf ? 'fa-file-pdf' : 'fa-file-image'"></i>
                </div>
                <div class="file-info">
                  <div class="file-name">{{ idFileName }}</div>
                  <div class="file-meta">On file since {{ formatDate(profile.createdAt) }}</div>
                </div>
                <div class="file-actions">
                  <a :href="profile.validIdUrl" target="_blank" rel="noopener" class="btn-ghost">
                    <i class="fas fa-eye"></i>View
                  </a>
                  <button class="btn-ghost" :disabled="uploadingId" @click="triggerIdUpload">
                    <i class="fas" :class="uploadingId ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
                    {{ uploadingId ? 'Uploading…' : 'Replace' }}
                  </button>
                </div>
              </div>
              <div v-else class="file-attachment empty">
                <div class="file-icon"><i class="fas fa-id-card"></i></div>
                <div class="file-info">
                  <div class="file-name">No ID on file</div>
                  <div class="file-meta">Upload a valid government ID (PDF, JPG, or PNG)</div>
                </div>
                <button class="btn-ghost" :disabled="uploadingId" @click="triggerIdUpload">
                  <i class="fas" :class="uploadingId ? 'fa-spinner fa-spin' : 'fa-upload'"></i>
                  {{ uploadingId ? 'Uploading…' : 'Upload' }}
                </button>
              </div>
              <!-- Single shared hidden input -->
              <input ref="idInput" type="file" accept=".pdf,.jpg,.jpeg,.png" hidden @change="handleIdUpload" />
            </div>
          </div>
          <div class="form-actions">
            <span v-if="isBusinessDirty" class="dirty-hint"><i class="fas fa-pen"></i>Unsaved changes</span>
            <button class="btn-primary" :disabled="!isBusinessDirty || savingBusiness" @click="saveBusiness">
              <i class="fas" :class="savingBusiness ? 'fa-spinner fa-spin' : 'fa-save'"></i>
              {{ savingBusiness ? 'Saving…' : 'Save Business Info' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ══════════ Security ══════════ -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-shield-alt" style="color:var(--wn)"></i>Security</h3>
        </div>
        <div class="card-body">
          <div class="security-row">
            <div class="security-info">
              <h4>Account Password</h4>
              <p v-if="canChangePassword">
                Minimum {{ PASSWORD_MIN_LENGTH }} characters with uppercase, lowercase, number, and special character.
                Changes are allowed once every {{ PASSWORD_COOLDOWN_DAYS }} days.
              </p>
              <p v-else class="cooldown-note">
                <i class="fas fa-clock"></i>
                <span>
                  For security, your password can only be changed once every {{ PASSWORD_COOLDOWN_DAYS }} days.<br />
                  You can change it again on <strong>{{ cooldownDateLabel }}</strong>
                  ({{ cooldownDaysLeft }} day{{ cooldownDaysLeft === 1 ? '' : 's' }} from now).
                </span>
              </p>
            </div>
            <button v-if="canChangePassword" class="btn-secondary" @click="togglePasswordForm">
              <i class="fas" :class="showPasswordForm ? 'fa-xmark' : 'fa-key'"></i>
              {{ showPasswordForm ? 'Cancel' : 'Change Password' }}
            </button>
            <button v-else class="btn-secondary" disabled title="Password change cooldown active">
              <i class="fas fa-lock"></i>Locked
            </button>
          </div>

          <div v-if="showPasswordForm && canChangePassword" class="password-form">
            <div class="form-grid">
              <div class="form-group full">
                <label>Current Password</label>
                <div class="pw-wrap">
                  <input v-model="passwordForm.current" :type="showCurrent ? 'text' : 'password'"
                         autocomplete="current-password"
                         autocapitalize="none" autocorrect="off" spellcheck="false"
                         placeholder="Enter your current password" />
                  <button type="button" class="pw-eye" @click="showCurrent = !showCurrent" :title="showCurrent ? 'Hide' : 'Show'">
                    <i class="fas" :class="showCurrent ? 'fa-eye-slash' : 'fa-eye'"></i>
                  </button>
                </div>
              </div>

              <div class="form-group full">
                <label>New Password</label>
                <div class="pw-wrap">
                  <input v-model="passwordForm.next" :type="showNext ? 'text' : 'password'"
                         autocomplete="new-password"
                         autocapitalize="none" autocorrect="off" spellcheck="false"
                         placeholder="Create a strong new password" />
                  <button type="button" class="pw-eye" @click="showNext = !showNext" :title="showNext ? 'Hide' : 'Show'">
                    <i class="fas" :class="showNext ? 'fa-eye-slash' : 'fa-eye'"></i>
                  </button>
                </div>

                <!-- Strength meter (green scale — never red) -->
                <div v-if="passwordForm.next.length > 0" class="strength">
                  <div class="strength-meter">
                    <div class="strength-fill" :class="strengthMeta.cls" :style="{ width: strengthPercent + '%' }"></div>
                  </div>
                  <span class="strength-label" :class="strengthMeta.cls">{{ strengthMeta.label }}</span>
                </div>
              </div>

              <div class="form-group full">
                <label>Confirm New Password</label>
                <div class="pw-wrap">
                  <input v-model="passwordForm.confirm" :type="showConfirm ? 'text' : 'password'"
                         autocomplete="new-password"
                         autocapitalize="none" autocorrect="off" spellcheck="false"
                         placeholder="Re-enter your new password"
                         :class="{ invalid: passwordForm.confirm.length > 0 && !passwordsMatch }" />
                  <button type="button" class="pw-eye" @click="showConfirm = !showConfirm" :title="showConfirm ? 'Hide' : 'Show'">
                    <i class="fas" :class="showConfirm ? 'fa-eye-slash' : 'fa-eye'"></i>
                  </button>
                </div>
                <small v-if="passwordForm.confirm.length > 0" class="field-note"
                       :class="passwordsMatch ? 'ok-text' : 'error-text'">
                  <i class="fas" :class="passwordsMatch ? 'fa-circle-check' : 'fa-circle-xmark'"></i>
                  {{ passwordsMatch ? 'Passwords match.' : 'Passwords do not match. ' + mismatchHint }}
                </small>
              </div>
            </div>

            <!-- Real-time requirement checklist (green progress — pending items are neutral, not red) -->
            <div class="pw-requirements">
              <div class="pw-req-title">
                <i class="fas fa-list-check"></i>
                Password Requirements
                <span class="pw-req-count" :class="{ done: allRulesPassed }">
                  {{ passwordRulesWithDiff.filter(r => r.passed).length }}/{{ passwordRulesWithDiff.length }}
                </span>
              </div>
              <div class="pw-req-grid">
                <div v-for="rule in passwordRulesWithDiff" :key="rule.key"
                     class="pw-req-item" :class="{ passed: rule.passed }">
                  <i :class="rule.passed ? 'fas fa-circle-check' : 'far fa-circle'"></i>
                  {{ rule.label }}
                </div>
              </div>
            </div>

            <p v-if="passwordError" class="form-error"><i class="fas fa-circle-exclamation"></i>{{ passwordError }}</p>
            <div class="form-actions">
              <button class="btn-primary" :disabled="!passwordSubmitReady || changingPassword" @click="changePassword">
                <i class="fas" :class="changingPassword ? 'fa-spinner fa-spin' : 'fa-check'"></i>
                {{ changingPassword ? 'Updating…' : 'Update Password' }}
              </button>
            </div>
          </div>

          <div class="divider"></div>

          <div class="security-row">
            <div class="security-info">
              <h4>Account Status</h4>
              <p>Your account is {{ isActive ? 'active' : 'inactive' }}. Registered {{ formatDate(profile.createdAt) }} by the LGU Tourism Office.</p>
            </div>
            <span class="badge lg" :class="isActive ? 'ok' : 'muted'">{{ isActive ? 'Active' : 'Inactive' }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════ Confirmation Modal ══════════ -->
    <transition name="modal">
      <div v-if="confirmModal.show" class="modal-overlay" @click.self="cancelConfirm">
        <div class="modal-card">
          <div class="modal-icon" :class="confirmModal.tone">
            <i class="fas" :class="confirmModal.tone === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-question'"></i>
          </div>
          <h3>{{ confirmModal.title }}</h3>
          <p class="modal-message">{{ confirmModal.message }}</p>

          <ul v-if="confirmModal.changes.length" class="changes-list">
            <li v-for="(c, i) in confirmModal.changes" :key="i">
              <span class="chg-label">{{ c.label }}</span>
              <span class="chg-values">
                <s class="chg-old">{{ c.old }}</s>
                <i class="fas fa-arrow-right"></i>
                <strong class="chg-new">{{ c.new }}</strong>
              </span>
            </li>
          </ul>

          <div class="modal-actions">
            <button class="btn-secondary" @click="cancelConfirm">{{ confirmModal.cancelText }}</button>
            <button class="btn-primary" :class="{ danger: confirmModal.tone === 'danger' }" @click="confirmAction">
              {{ confirmModal.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="toast">
      <div v-if="toast.show" class="toast" :class="toast.type">
        <i class="fas" :class="toast.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════
   SUCCESS GREEN — hardcoded so it can never be overridden by
   a theme variable (e.g., --dg being "danger red" in this app)
   ══════════════════════════════════════════════════════════ */
.owner-profile {
  --success: #B0D91E;
  --success-dark: #B0D91E;
  --success-bg: rgba(16, 185, 129, .12);
  --danger: #F20707;
}

.owner-profile { animation: fadeIn .5s ease; max-width: 1000px; margin: 0 auto; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.page-title { margin-bottom: 28px; }
.page-title h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(28px, 5vw, 40px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0 0 6px; line-height: 1.1; }
.page-title h1 span { background: linear-gradient(135deg, var(--ac), var(--wn)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.page-title p { color: var(--mt); font-size: 14px; margin: 0; }

.card { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; overflow: hidden; margin-bottom: 24px; }
.card-header { padding: 20px 24px; border-bottom: 1px solid var(--bdr); }
.card-header h3 { font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 700; color: var(--fg); margin: 0; display: flex; align-items: center; gap: 10px; }
.card-body { padding: 24px; }

.state-box { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 24px; color: var(--mt); background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; text-align: center; }
.state-box i { font-size: 32px; color: var(--wn); }
.state-box p { margin: 0; font-size: 14px; }
.spinner { width: 36px; height: 36px; border: 3px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.profile-summary { display: flex; gap: 24px; margin-bottom: 32px; padding-bottom: 32px; border-bottom: 1px solid var(--bdr); align-items: center; }
.avatar { width: 84px; height: 84px; border-radius: 16px; background: linear-gradient(135deg, var(--ac), var(--wn)); display: flex; align-items: center; justify-content: center; font-family: 'Unbounded', sans-serif; font-size: 30px; font-weight: 800; color: #fff; box-shadow: 0 12px 32px var(--acg); position: relative; flex-shrink: 0; }
.status-dot { position: absolute; bottom: -2px; right: -2px; width: 22px; height: 22px; border-radius: 50%; background: var(--success); border: 3px solid var(--card); }
.status-dot.inactive { background: var(--mt); }
.profile-info h2 { font-family: 'Unbounded', sans-serif; font-size: 24px; font-weight: 800; color: var(--fg); margin: 0 0 6px; }
.business { color: var(--ac); font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.email { color: var(--mt); font-size: 13px; display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.meta-row { display: flex; align-items: center; gap: 12px; }
.meta-text { color: var(--mt); font-size: 12px; }

/* Badges — hardcoded green for "ok" */
.badge { padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
.badge.ok { background: var(--success-bg); color: var(--success-dark); }
.badge.muted { background: var(--bg2); color: var(--mt); }
.badge.lg { font-size: 12px; padding: 8px 16px; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 24px; }
.form-group { display: flex; flex-direction: column; }
.form-group.full { grid-column: 1 / -1; }
.form-group label { display: block; color: var(--fg2); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
.optional { text-transform: none; font-weight: 500; color: var(--mt); }

.form-group input { width: 100%; padding: 12px 16px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; color: var(--fg); font-size: 14px; transition: all .3s; outline: none; box-sizing: border-box; }
.form-group input:focus { border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }
.form-group input.invalid { border-color: var(--danger); }
.disabled-input { opacity: .6; cursor: not-allowed; background: var(--card2) !important; }

/* Field notes — green for OK, red ONLY for genuine mismatch */
.field-note { font-size: 11px; color: var(--mt); margin-top: 6px; display: flex; align-items: center; gap: 6px; }
.field-note.error-text { color: var(--danger); }
.field-note.ok-text { color: var(--success-dark); }
.dirty-hint { font-size: 12px; color: var(--wn); font-weight: 600; display: flex; align-items: center; gap: 6px; margin-right: auto; }

/* Password input wrapper with eye toggle */
.pw-wrap { position: relative; width: 100%; }
.pw-wrap input { padding-right: 48px; }
.pw-eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border: none; background: transparent; color: var(--mt); cursor: pointer; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all .2s; }
.pw-eye:hover { color: var(--ac); background: var(--acs); }

/* ── Strength meter: GREEN SCALE (light → deep green) ──
   Never red — a weak-but-typed password is "in progress",
   not a failure. */
.strength { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.strength-meter { flex: 1; height: 6px; background: var(--bdr); border-radius: 3px; overflow: hidden; }
.strength-fill { height: 100%; border-radius: 3px; transition: width .3s ease, background-color .3s; }
.strength-fill.s-1 { width: 17%; background: #F4F8E3; }
.strength-fill.s-2 { width: 33%; background: #F4F8E3; }
.strength-fill.s-3 { width: 50%; background: #F4F8E3; }
.strength-fill.s-4 { width: 67%; background: #B0D91E; }
.strength-fill.s-5 { width: 83%; background: var(--success); }
.strength-fill.s-6 { width: 100%; background: var(--success-dark); }
.strength-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; white-space: nowrap; }
.strength-label.s-1, .strength-label.s-2 { color: #F4F8E3; }
.strength-label.s-3 { color: #B0D91E; }
.strength-label.s-4 { color: var(--success); }
.strength-label.s-5, .strength-label.s-6 { color: var(--success-dark); }

/* ── Requirements checklist:
   PASSED  = solid green check (hardcoded green)
   PENDING = neutral outline circle (reads as "not yet", NOT "failed") */
.pw-requirements { background: var(--bg2); border: 1px solid var(--bdr); border-left: 3px solid var(--success); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; }
.pw-req-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--fg2); display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.pw-req-title > i { color: var(--success); }
.pw-req-count { margin-left: auto; font-size: 11px; padding: 3px 10px; border-radius: 999px; background: var(--success-bg); color: var(--success-dark); transition: all .3s; }
.pw-req-count.done { background: var(--success); color: #fff; }
.pw-req-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 20px; }
.pw-req-item { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--mt); transition: color .2s; }
.pw-req-item i { font-size: 13px; width: 16px; color: var(--bdr); transition: color .2s; }
.pw-req-item.passed { color: var(--fg); }
.pw-req-item.passed i { color: var(--success); }

.file-attachment { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg2); border: 1px dashed var(--bdr); border-radius: 12px; transition: all .3s; box-sizing: border-box; width: 100%; }
.file-attachment:hover { border-color: var(--ac); background: var(--acs); }
.file-attachment.empty { border-style: solid; }
.file-icon { width: 44px; height: 44px; border-radius: 10px; background: var(--bg2); color: var(--mt); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.file-icon.img { background: var(--acs); color: var(--ac); }
.file-info { flex: 1; min-width: 0; }
.file-name { font-size: 14px; font-weight: 600; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-meta { font-size: 12px; color: var(--mt); margin-top: 4px; }
.file-actions { display: flex; gap: 8px; flex-shrink: 0; }

.btn-ghost { background: transparent; color: var(--ac); border: 1px solid var(--bdr); padding: 10px 16px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s; white-space: nowrap; text-decoration: none; }
.btn-ghost:hover { background: var(--ac); color: #fff; border-color: var(--ac); }
.btn-ghost:disabled { opacity: .6; cursor: not-allowed; }

.btn-primary { padding: 12px 24px; background: var(--eco-mint); color: var(--bb-on-highlight); border: none; border-radius: 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .3s; box-shadow: 0 8px 24px var(--acg); }
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 36px var(--acg); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary.danger { background: linear-gradient(135deg, #C70505, var(--danger)); box-shadow: 0 8px 24px rgba(198,40,40,.3); }

.btn-secondary { padding: 10px 20px; background: var(--bg2); color: var(--fg2); border: 1px solid var(--bdr); border-radius: 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .3s; white-space: nowrap; }
.btn-secondary:hover:not(:disabled) { background: var(--card2); transform: translateY(-2px); }
.btn-secondary:disabled { opacity: .6; cursor: not-allowed; }

.form-actions { display: flex; justify-content: flex-end; align-items: center; margin-top: 8px; }
.form-error { color: var(--danger); font-size: 13px; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }

.security-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.security-info { flex: 1; }
.security-info h4 { font-size: 15px; font-weight: 700; margin: 0 0 6px; color: var(--fg); }
.security-info p { font-size: 13px; color: var(--mt); margin: 0; line-height: 1.4; }
.cooldown-note { display: flex; align-items: flex-start; gap: 10px; }
.cooldown-note i { margin-top: 2px; color: var(--wn); }
.cooldown-note strong { color: var(--fg); }
.divider { height: 1px; background: var(--bdr); margin: 24px 0; }

.password-form { margin-top: 20px; padding: 20px; background: var(--bg2); border-radius: 12px; border: 1px solid var(--bdr); }

/* ── Confirmation Modal ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 24px; }
.modal-card { background: var(--card); border: 1px solid var(--bdr); border-radius: 18px; padding: 28px; width: 100%; max-width: 440px; text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,.35); }
.modal-icon { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
.modal-icon.primary { background: var(--acs); color: var(--ac); }
.modal-icon.danger { background: rgba(198,40,40,.12); color: #C70505; }
.modal-card h3 { font-family: 'Unbounded', sans-serif; font-size: 17px; font-weight: 700; color: var(--fg); margin: 0 0 8px; }
.modal-message { font-size: 13.5px; color: var(--mt); line-height: 1.5; margin: 0 0 16px; }

.changes-list { list-style: none; margin: 0 0 20px; padding: 14px 16px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 12px; text-align: left; max-height: 200px; overflow-y: auto; }
.changes-list li { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; font-size: 12.5px; }
.changes-list li + li { border-top: 1px dashed var(--bdr); }
.chg-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--mt); }
.chg-values { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--fg); }
.chg-old { color: var(--mt); word-break: break-all; }
.chg-values i { font-size: 10px; color: var(--ac); flex-shrink: 0; }
.chg-new { color: var(--ac); word-break: break-all; }

.modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
.modal-actions .btn-secondary, .modal-actions .btn-primary { flex: 1; justify-content: center; }

/* Modal transition */
.modal-enter-active, .modal-leave-active { transition: opacity .25s ease; }
.modal-enter-active .modal-card, .modal-leave-active .modal-card { transition: transform .25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-card, .modal-leave-to .modal-card { transform: scale(.94) translateY(8px); }

/* Toast */
.toast { position: fixed; top: 24px; right: 24px; z-index: 10001; display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; color: #fff; box-shadow: 0 12px 32px rgba(0,0,0,.25); max-width: 380px; }
.toast.success { background: var(--success); }
.toast.error { background: var(--danger); }
.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-12px); }

@media (max-width: 768px) {
  .form-grid { grid-template-columns: 1fr; }
  .pw-req-grid { grid-template-columns: 1fr; }
  .profile-summary { flex-direction: column; text-align: center; }
  .meta-row, .email { justify-content: center; }
  .security-row { flex-direction: column; align-items: flex-start; }
  .file-attachment { flex-wrap: wrap; }
  .btn-secondary, .btn-primary { width: 100%; justify-content: center; }
  .dirty-hint { width: 100%; justify-content: center; }
}
</style>