<template>
    <Teleport to="body">
      <Transition name="rc">
        <div v-if="open" class="rc-backdrop" @click.self="emit('close')">
          <div class="rc-panel" role="dialog" aria-modal="true" aria-label="Chat with resort">
            <header class="rc-head">
              <div class="rc-id">
                <div class="rc-av">{{ initials }}</div>
                <div class="rc-idtx">
                  <h4>{{ hotel?.name || 'Resort' }}</h4>
                  <p>{{ hotel?.location || 'Baco, Oriental Mindoro' }}</p>
                </div>
              </div>
              <button class="rc-x" @click="emit('close')" aria-label="Close chat">✕</button>
            </header>
  
            <div ref="rcBox" class="rc-msgs">
              <div v-if="loading" class="rc-state"><div class="rc-spin"></div></div>
              <div v-else-if="messages.length === 0" class="rc-state rc-hello">
                <span class="rc-emoji">💬</span>
                <p>Say hello to <b>{{ hotel?.name }}</b> — ask about rates, availability, or anything else.</p>
              </div>
              <div v-for="m in messages" :key="m.id" class="rc-wrap" :class="m.type">
                <div class="rc-bubble">{{ m.text }}</div>
                <div class="rc-time">{{ fmtTime(m.createdAt) }}</div>
              </div>
            </div>
  
            <div v-if="sendError" class="rc-error">{{ sendError }}</div>
  
            <footer class="rc-input">
              <input
                ref="rcInput"
                v-model="draft"
                type="text"
                maxlength="2000"
                :placeholder="'Message ' + (hotel?.name || 'resort') + '…'"
                @keypress.enter="send"
              />
              <button class="rc-send" :disabled="!draft.trim() || sending" @click="send" aria-label="Send message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </template>
  
  <script setup>
  import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
  import { useUserStore } from '../../stores/useUserStore'
  
  const props = defineProps({
    open: { type: Boolean, default: false },
    hotel: { type: Object, default: null }
  })
  const emit = defineEmits(['close'])
  
  const userStore = useUserStore()
  // ⚠️ Same base your other direct calls use — swap for an env var when deploying
  const API = 'http://localhost:3000/api'
  
  const messages = ref([])
  const loading = ref(false)
  const sending = ref(false)
  const sendError = ref('')
  const draft = ref('')
  const rcBox = ref(null)
  const rcInput = ref(null)
  let pollTimer = null
  
  const initials = computed(() =>
    (props.hotel?.name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  )
  
  function scrollBottom() {
    if (rcBox.value) rcBox.value.scrollTop = rcBox.value.scrollHeight
  }
  function fmtTime(iso) {
    if (!iso) return ''
    const d = new Date(iso), n = new Date()
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (d.toDateString() === n.toDateString()) return t
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + t
  }
  
  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (userStore.token || ''),
        ...(opts.headers || {})
      }
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'Request failed')
    return res.json()
  }
  
  async function loadThread() {
    if (!props.hotel?.id) return
    loading.value = messages.value.length === 0
    try {
      const data = await api(`/hotels/${props.hotel.id}/messages`)
      messages.value = data.messages || []
      nextTick(scrollBottom)
    } catch (e) { /* keep whatever we have */ }
    finally { loading.value = false }
  }
  
  async function send() {
    const text = draft.value.trim()
    if (!text || sending.value || !props.hotel?.id) return
    const tempId = 'tmp-' + Date.now()
    messages.value.push({ id: tempId, text, type: 'sent', createdAt: new Date().toISOString() })
    draft.value = ''
    sending.value = true
    sendError.value = ''
    nextTick(scrollBottom)
    try {
      const data = await api(`/hotels/${props.hotel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: text })
      })
      messages.value = data.messages || []
    } catch (e) {
      messages.value = messages.value.filter(m => m.id !== tempId)
      sendError.value = e.message || 'Message failed to send. Please try again.'
    } finally {
      sending.value = false
      nextTick(scrollBottom)
    }
  }
  
  function startPolling() {
    stopPolling()
    pollTimer = setInterval(loadThread, 5000) // owner replies arrive while the chat is open
  }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }
  function onKey(e) { if (e.key === 'Escape') emit('close') }
  
  watch(() => props.open, (v) => {
    if (v) {
      messages.value = []
      sendError.value = ''
      loadThread()
      startPolling()
      window.addEventListener('keydown', onKey)
      nextTick(() => rcInput.value?.focus())
    } else {
      stopPolling()
      window.removeEventListener('keydown', onKey)
    }
  })
  onBeforeUnmount(() => {
    stopPolling()
    window.removeEventListener('keydown', onKey)
  })
  </script>
  
  <style scoped>
  .rc-backdrop {
    position: fixed; inset: 0; z-index: 9998;
    background: rgba(0,0,0,.55);
    display: flex; align-items: center; justify-content: center; padding: 18px;
  }
  .rc-panel {
    width: min(420px, 100%);
    height: min(560px, calc(100vh - 60px));
    display: flex; flex-direction: column;
    background: var(--bb-surface, #fff);
    border: 1px solid var(--bb-border, #dfe7e2);
    border-radius: 22px;
    box-shadow: 0 30px 70px -20px rgba(0,0,0,.55);
    overflow: hidden;
    font-family: var(--bb-font-body);
  }
  .rc-head {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--bb-border, #dfe7e2);
    background: var(--bb-surface, #fff);
  }
  .rc-id { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .rc-av {
    width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
    background: var(--bb-accent);
    color: var(--bb-on-accent, #fff);
    display: flex; align-items: center; justify-content: center;
    font-weight: var(--bb-weight-bold); font-size: var(--bb-text-sm);
  }
  .rc-idtx { min-width: 0; }
  .rc-idtx h4 { margin: 0; font-size: var(--bb-text-md); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink, #12261b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rc-idtx p { margin: 2px 0 0; font-size: var(--bb-text-xs); color: var(--bb-text-tertiary, #7c8a81); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rc-x {
    width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer; flex-shrink: 0;
    background: var(--bb-bg-subtle, #eef3ef); color: var(--bb-text-tertiary, #7c8a81);
    font-size: var(--bb-text-xs); display: flex; align-items: center; justify-content: center;
    transition: all .2s;
  }
  .rc-x:hover { background: var(--bb-accent-soft, rgba(29,122,79,.12)); color: var(--bb-accent, #1d7a4f); }
  
  .rc-msgs {
    flex: 1; overflow-y: auto;
    padding: 16px;
    display: flex; flex-direction: column; gap: 6px;
    background: color-mix(in srgb, var(--bb-accent, #1d7a4f) 6%, var(--bb-bg-subtle, #eef3ef));
  }
  @supports not (background: color-mix(in srgb, red, blue)) {
    .rc-msgs { background: var(--bb-bg-subtle, #eef3ef); }
  }
  .rc-state {
    margin: auto; text-align: center; color: var(--bb-text-tertiary, #7c8a81);
    font-size: var(--bb-text-sm); max-width: 260px; line-height: 1.55;
  }
  .rc-hello .rc-emoji { font-size: var(--bb-text-4xl); display: block; margin-bottom: 8px; }
  .rc-hello b { color: var(--bb-ink, #12261b); }
  .rc-spin {
    width: 30px; height: 30px; margin: auto;
    border: 3px solid var(--bb-border, #dfe7e2); border-top-color: var(--bb-accent, #1d7a4f);
    border-radius: 50%; animation: rcSpin .8s linear infinite;
  }
  @keyframes rcSpin { to { transform: rotate(360deg); } }
  
  .rc-wrap { display: flex; flex-direction: column; max-width: 78%; animation: rcIn .22s ease-out; }
  @keyframes rcIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .rc-wrap.sent { align-self: flex-end; align-items: flex-end; }
  .rc-wrap.received { align-self: flex-start; align-items: flex-start; }
  .rc-bubble {
    padding: 9px 14px; border-radius: 18px;
    font-size: var(--bb-text-base); line-height: 1.45; word-wrap: break-word; white-space: pre-wrap;
  }
  .sent .rc-bubble { background: var(--bb-accent, #1d7a4f); color: var(--bb-on-accent, #fff); border-bottom-right-radius: 5px; }
  .received .rc-bubble { background: var(--bb-surface, #fff); color: var(--bb-ink, #12261b); border: 1px solid var(--bb-border, #dfe7e2); border-bottom-left-radius: 5px; }
  .rc-time { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary, #7c8a81); margin-top: 3px; padding: 0 6px; }
  
  .rc-error {
    padding: 8px 16px; font-size: var(--bb-text-xs); font-weight: var(--bb-weight-semibold);
    background: var(--bb-danger-soft, #fdecec); color: var(--bb-danger, #c0392b);
    border-top: 1px solid var(--bb-danger, #c0392b);
  }
  .rc-input {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 14px; border-top: 1px solid var(--bb-border, #dfe7e2);
    background: var(--bb-surface, #fff);
  }
  .rc-input input {
    flex: 1; min-width: 0;
    padding: 10px 15px; border-radius: 999px;
    border: 1px solid var(--bb-border, #dfe7e2);
    background: var(--bb-bg-subtle, #eef3ef);
    font-size: var(--bb-text-base); font-family: inherit; color: var(--bb-ink, #12261b);
    outline: none; transition: border .2s, box-shadow .2s;
  }
  .rc-input input::placeholder { color: var(--bb-text-tertiary, #7c8a81); }
  .rc-input input:focus { border-color: var(--bb-accent, #1d7a4f); box-shadow: 0 0 0 3px var(--bb-accent-soft, rgba(29,122,79,.15)); }
  .rc-send {
    width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; flex-shrink: 0;
    background: var(--bb-accent, #1d7a4f); color: var(--bb-on-accent, #fff);
    display: flex; align-items: center; justify-content: center;
    transition: opacity .2s, transform .15s;
  }
  .rc-send:hover:not(:disabled) { transform: translateY(-1px); }
  .rc-send:disabled { opacity: .4; cursor: not-allowed; }
  
  .rc-enter-active, .rc-leave-active { transition: opacity .22s ease; }
  .rc-enter-active .rc-panel, .rc-leave-active .rc-panel { transition: transform .26s cubic-bezier(.22,.61,.36,1), opacity .22s ease; }
  .rc-enter-from, .rc-leave-to { opacity: 0; }
  .rc-enter-from .rc-panel, .rc-leave-to .rc-panel { transform: scale(.92) translateY(14px); }
  
  @media (max-width: 480px) {
    .rc-backdrop { padding: 8px; }
    .rc-panel { width: 100%; height: calc(100vh - 40px); border-radius: 18px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .rc-wrap, .rc-enter-active .rc-panel, .rc-leave-active .rc-panel { animation: none !important; transition: none !important; }
  }
  </style>
