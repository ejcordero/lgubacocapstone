<template>
  <div class="msg-pop">
    <div class="msg-panel">
      <div class="msg-app" :class="{ 'chat-open': mobileChatOpen }">

        <!-- ── SIDEBAR ── -->
        <aside class="m-sidebar">
          <div class="m-sh">
            <h2>Messages</h2>
            <button class="m-close" title="Close" @click="emit('close')">✕</button>
          </div>
          <input v-model="search" type="text" class="m-search" placeholder="Search conversations" />
          <div class="m-list">
            <div
              v-for="c in filteredChats"
              :key="c.id"
              class="m-item"
              :class="{ active: c.id === activeId }"
              @click="openChat(c)"
            >
              <div class="m-avatar">{{ c.initials }}</div>
              <div class="m-item-info">
                <div class="m-item-name">
                  {{ c.name }}
                  <span v-if="c.unread" class="m-unread">{{ c.unread }}</span>
                </div>
                <div class="m-item-preview">{{ lastMsg(c) }}</div>
              </div>
            </div>
            <div v-if="filteredChats.length === 0" class="m-noresults">No conversations found.</div>
          </div>
        </aside>

        <!-- ── CHAT AREA ── -->
        <main class="m-chat">
          <template v-if="activeChat">
            <header class="m-chat-header">
              <div class="m-ch-left">
                <button class="m-back" @click="backToList">←</button>
                <div class="m-ch-avatar">{{ activeChat.initials }}</div>
                <div class="m-ch-info">
                  <h3>{{ activeChat.name }}</h3>
                  <div class="m-ch-status">{{ activeChat.status }}</div>
                </div>
              </div>
            </header>

            <div ref="msgBox" class="m-msgs">
              <div
                v-for="msg in activeChat.messages"
                :key="msg.id"
                class="m-wrap"
                :class="msg.type"
              >
                <div class="m-bubble">{{ msg.text }}</div>
                <div v-if="msg.reaction" class="m-reaction">{{ msg.reaction }}</div>
                <div class="m-time">{{ msg.time }}</div>
                <div class="m-actions">
                  <button class="m-act" title="Reply" @click="replyFocus">↩️</button>
                  <button class="m-act" title="React" @click="toggleReact(msg)">{{ msg.reaction ? '💔' : '❤️' }}</button>
                  <button class="m-act" title="Copy" @click="copyMsg(msg)">{{ copiedId === msg.id ? '✓' : '📋' }}</button>
                </div>
              </div>

              <!-- Typing indicator -->
              <div v-if="typingIn === activeChat.id" class="m-typing">
                <div class="m-dot"></div>
                <div class="m-dot"></div>
                <div class="m-dot"></div>
              </div>
            </div>

            <footer class="m-input-area">
              <button class="m-ibtn" title="Attach">+</button>
              <button class="m-ibtn m-emoji-btn" title="Emoji" @click="showEmoji = !showEmoji">😊</button>
              <input
                ref="msgInput"
                v-model="newMessage"
                type="text"
                class="m-input"
                placeholder="Type a message…"
                @keypress.enter="send"
              />
              <button class="m-send" :disabled="!newMessage.trim()" @click="send">Send</button>

              <!-- Emoji picker -->
              <div v-if="showEmoji" class="m-emoji-picker">
                <div class="m-emoji-grid">
                  <div
                    v-for="e in emojis"
                    :key="e"
                    class="m-emoji-item"
                    @click="selectEmoji(e)"
                  >{{ e }}</div>
                </div>
              </div>
            </footer>
          </template>

          <!-- Desktop empty state -->
          <div v-else class="m-empty">
            <div class="m-empty-emoji">💬</div>
            <p>Select a conversation to start messaging.</p>
          </div>
        </main>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../../../stores/useUserStore'

const emit = defineEmits(['close'])
const userStore = useUserStore()
// Reads VITE_API_URL from .env; falls back to localhost for dev
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// ── Real conversations (loaded from the backend) ──
const chats = ref([])

const emojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓',
  '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔',
  '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
  '😠', '🤯', '😳', '🥵', '🥶', '😱', '🤗', '🤔',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👋',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '💯', '💥', '💫', '🔥', '✨', '🌟', '⭐', '🎉',
]

// ── State (same names the template binds to) ──
const activeId = ref(null)
const search = ref('')
const newMessage = ref('')
const typingIn = ref(null)
const mobileChatOpen = ref(false)
const showEmoji = ref(false)
const copiedId = ref(null)

const msgBox = ref(null)
const msgInput = ref(null)
let pollTimer = null
let sending = false

// ── Derived ──
const filteredChats = computed(() =>
  chats.value.filter(c => c.name.toLowerCase().includes(search.value.toLowerCase()))
)
const activeChat = computed(() => chats.value.find(c => c.id === activeId.value) || null)
const lastMsg = (c) =>
  c.messages.length ? c.messages[c.messages.length - 1].text : (c.preview || 'No messages yet')

// ── Helpers ──
const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso), n = new Date()
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === n.toDateString()) return t
  const y = new Date(n); y.setDate(n.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  if (n - d < 7 * 86400000) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
const toInitials = (name) =>
  (name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()

function scrollBottom() {
  if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight
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
const mapMsg = (m) => ({ id: m.id, text: m.text, type: m.type, time: fmtTime(m.createdAt), reaction: m.reaction || null })

// ── Data loading (merge, never clobber an open thread) ──
async function loadConversations() {
  try {
    const data = await api('/messages/conversations')
    const byId = new Map(chats.value.map(c => [c.id, c]))
    chats.value = data.map(c => {
      const chat = byId.get(c.id) || { id: c.id, messages: [] }
      chat.name = c.name
      chat.initials = toInitials(c.name)
      chat.status = c.location || 'Resort'
      chat.unread = c.unread || 0
      chat.preview = c.lastMessage || ''
      chat.lastAt = c.lastAt
      return chat
    })
  } catch (e) { /* keep the current list on failure */ }
}

async function openChat(c) {
  activeId.value = c.id
  c.unread = 0
  mobileChatOpen.value = true
  showEmoji.value = false
  typingIn.value = c.id // dots double as the loading indicator
  nextTick(scrollBottom)
  try {
    const data = await api(`/messages/conversations/${c.id}/messages`)
    const chat = chats.value.find(x => x.id === c.id)
    if (chat && activeId.value === c.id) chat.messages = data.messages.map(mapMsg)
  } catch (e) { /* leave whatever is loaded */ }
  typingIn.value = null
  nextTick(scrollBottom)
}

async function send() {
  const text = newMessage.value.trim()
  if (!text || !activeChat.value || sending) return
  const chat = activeChat.value
  const tempId = 'tmp-' + Date.now()
  chat.messages.push({ id: tempId, text, type: 'sent', time: now() }) // optimistic
  newMessage.value = ''
  showEmoji.value = false
  sending = true
  nextTick(scrollBottom)
  try {
    const data = await api(`/messages/conversations/${chat.id}/messages`, {
      method: 'POST', body: JSON.stringify({ body: text })
    })
    chat.messages = data.messages.map(mapMsg)
  } catch (e) {
    chat.messages = chat.messages.filter(m => m.id !== tempId)
    newMessage.value = text // restore the draft so nothing is lost
  }
  sending = false
  nextTick(scrollBottom)
}

// Owner replies arrive while the popup is open
async function poll() {
  if (sending) return
  await loadConversations()
  const chat = activeChat.value
  if (!chat) return
  try {
    const data = await api(`/messages/conversations/${chat.id}/messages`)
    const mapped = data.messages.map(mapMsg).filter(m => typeof m.id === 'number')
    const known = new Set(chat.messages.map(m => m.id))
    const fresh = mapped.filter(m => !known.has(m.id))
    if (fresh.length) { chat.messages.push(...fresh); nextTick(scrollBottom) }
    // keep reactions on already-loaded messages in sync
    for (const m of mapped) {
      const local = chat.messages.find(x => x.id === m.id)
      if (local && local.reaction !== (m.reaction || null)) local.reaction = m.reaction || null
    }
  } catch (e) { /* ignore */ }
}

// ── Jumped into from HotelBrowse ("Message the resort") ──
async function selectFromOutside(convId) {
  let c = chats.value.find(x => x.id === Number(convId))
  if (!c) { await loadConversations(); c = chats.value.find(x => x.id === Number(convId)) }
  if (c) openChat(c)
}
const onExternalSelect = (e) => selectFromOutside(e.detail?.conversationId)

// ── Interactions ──
function backToList() { mobileChatOpen.value = false }

function selectEmoji(e) {
  newMessage.value += e
  msgInput.value?.focus()
}
function replyFocus() { msgInput.value?.focus() }

// Persistent reaction — saved to DB, synced to the other side via polling
async function toggleReact(msg) {
  if (!activeChat.value || typeof msg.id !== 'number') return // can't react to an unsent message
  const prev = msg.reaction || null
  const next = prev ? null : '❤️'
  msg.reaction = next // optimistic
  try {
    await api(`/messages/conversations/${activeChat.value.id}/messages/${msg.id}/reaction`, {
      method: 'PUT', body: JSON.stringify({ reaction: next })
    })
  } catch { msg.reaction = prev } // revert on failure
}

async function copyMsg(msg) {
  try {
    await navigator.clipboard.writeText(msg.text)
    copiedId.value = msg.id
    setTimeout(() => { copiedId.value = null }, 1200)
  } catch (e) { /* clipboard unavailable — ignore */ }
}

// ── Click outside / Escape handling ──
function onDocMousedown(e) {
  if (!e.target.closest('.msg-pop') && !e.target.closest('.hb-env')) emit('close')
  if (showEmoji.value && !e.target.closest('.m-emoji-picker') && !e.target.closest('.m-emoji-btn')) {
    showEmoji.value = false
  }
}
function onKeydown(e) {
  if (e.key === 'Escape') {
    if (showEmoji.value) { showEmoji.value = false; return }
    emit('close')
  }
}
onMounted(() => {
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('baco:select-chat', onExternalSelect)
  loadConversations()
  // HotelBrowse asked us to open a specific resort thread
  const pending = sessionStorage.getItem('baco_pending_chat')
  if (pending) { sessionStorage.removeItem('baco_pending_chat'); selectFromOutside(pending) }
  pollTimer = setInterval(poll, 5000)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('baco:select-chat', onExternalSelect)
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
/* Themed on the Basecamp Baco --bb-* tokens so the popup follows the
   user portal's eco-glassmorphism look and its dark mode. */

/* Anchored to the .msg-wrap wrapper around the envelope button in
   UserHeader — so alignment is exact and immune to the width of
   the profile name/text beside it. */
.msg-pop {
  position: absolute;
  top: calc(100% + 10px);
  right: -6px;
  z-index: 120;
}
/* Caret pointing at the envelope: panel right edge is 6px past the
   button's right edge; button center is 20px from its own right edge
   → 26px; minus half the 14px caret = 19px. */
.msg-pop::before {
  content: '';
  position: absolute;
  top: -7px;
  right: 19px;
  width: 14px;
  height: 14px;
  background: var(--bb-surface);
  border-left: 1px solid var(--bb-border-strong);
  border-top: 1px solid var(--bb-border-strong);
  transform: rotate(45deg);
  border-radius: 3px;
}

.msg-panel {
  width: min(720px, calc(100vw - 32px));
  height: 520px;
  max-height: calc(100vh - 100px);
  background: var(--bb-surface);
  border: 1px solid var(--bb-border);
  border-radius: 18px;
  box-shadow: var(--bb-glass-lg);
  overflow: hidden;
  animation: popIn 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  font-family: var(--bb-font-body);
}
@keyframes popIn {
  from { opacity: 0; transform: translateY(-10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.msg-app { display: flex; width: 100%; height: 100%; }

/* ── SIDEBAR ── */
.m-sidebar {
  width: 280px;
  min-width: 280px;
  background: var(--bb-surface);
  border-right: 1px solid var(--bb-border);
  display: flex;
  flex-direction: column;
}
.m-sh {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--bb-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.m-sh h2 { font-size: var(--bb-text-xl); font-weight: var(--bb-weight-bold); margin: 0; color: var(--bb-ink); }
.m-close {
  background: var(--bb-bg-subtle); border: none; border-radius: 8px;
  width: 26px; height: 26px; font-size: var(--bb-text-xs); color: var(--bb-text-tertiary);
  cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center;
}
.m-close:hover { background: var(--bb-border); color: var(--bb-ink); }

.m-search {
  margin: 12px;
  padding: 9px 14px;
  border-radius: 10px;
  border: none;
  background: var(--bb-bg-subtle);
  font-size: var(--bb-text-base);
  outline: none;
  font-family: inherit;
  color: var(--bb-ink);
}
.m-search::placeholder { color: var(--bb-text-tertiary); }
.m-list { flex: 1; overflow-y: auto; }

.m-item {
  display: flex; align-items: center;
  padding: 11px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--bb-border);
}
.m-item:hover { background: var(--bb-bg-subtle); }
.m-item.active { background: var(--bb-accent-soft); }

.m-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--bb-accent);
  display: flex; align-items: center; justify-content: center;
  color: var(--bb-on-accent); font-weight: var(--bb-weight-semibold); font-size: var(--bb-text-md);
  margin-right: 12px; flex-shrink: 0;
}
.m-item-info { flex: 1; min-width: 0; }
.m-item-name {
  font-weight: var(--bb-weight-semibold); font-size: var(--bb-text-base); margin-bottom: 3px; color: var(--bb-ink);
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.m-unread {
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
  background: var(--bb-accent); color: var(--bb-on-accent); font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.m-item-preview {
  font-size: var(--bb-text-xs); color: var(--bb-text-tertiary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.m-noresults { padding: 24px 16px; font-size: var(--bb-text-sm); color: var(--bb-text-tertiary); text-align: center; }

/* ── CHAT AREA ── */
.m-chat {
  flex: 1; display: flex; flex-direction: column;
  background: var(--bb-surface); min-width: 0;
}
.m-chat-header {
  padding: 12px 18px;
  border-bottom: 1px solid var(--bb-border);
  display: flex; align-items: center; justify-content: space-between;
  background: var(--bb-surface);
}
.m-ch-left { display: flex; align-items: center; flex: 1; }
.m-back {
  display: none;
  background: none; border: none; font-size: var(--bb-text-2xl); cursor: pointer;
  margin-right: 12px; color: var(--bb-accent-ink); padding: 0 4px; line-height: 1;
}
.m-ch-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--bb-accent);
  display: flex; align-items: center; justify-content: center;
  color: var(--bb-on-accent); font-weight: var(--bb-weight-semibold); font-size: var(--bb-text-sm); margin-right: 11px;
}
.m-ch-info h3 { font-size: var(--bb-text-md); font-weight: var(--bb-weight-semibold); margin: 0; color: var(--bb-ink); }
.m-ch-status { font-size: var(--bb-text-xs); color: var(--bb-success); }

/* ── MESSAGES ── */
.m-msgs {
  flex: 1; overflow-y: auto;
  padding: 18px 20px;
  display: flex; flex-direction: column; gap: 6px;
  background: var(--bb-surface);
}
.m-wrap {
  display: flex; flex-direction: column;
  max-width: 72%;
  position: relative;
  animation: msgIn 0.25s ease-out;
}
@keyframes msgIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.m-wrap.sent { align-self: flex-end; align-items: flex-end; }
.m-wrap.received { align-self: flex-start; align-items: flex-start; }

.m-bubble {
  padding: 9px 15px;
  border-radius: 18px;
  font-size: var(--bb-text-base);
  line-height: 1.4;
  word-wrap: break-word;
}
.sent .m-bubble { background: var(--bb-accent); color: var(--bb-on-accent); border-bottom-right-radius: 5px; }
.received .m-bubble { background: var(--bb-bg-subtle); color: var(--bb-ink); border-bottom-left-radius: 5px; }

.m-reaction { font-size: var(--bb-text-xs); margin-top: 2px; padding: 0 6px; }
.m-time { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); margin-top: 3px; padding: 0 6px; }

.m-actions {
  display: none;
  position: absolute;
  top: 50%; transform: translateY(-50%);
  background: var(--bb-surface);
  border-radius: 18px;
  box-shadow: var(--bb-shadow-md);
  padding: 4px;
  gap: 2px;
  z-index: 5;
}
.sent .m-actions { left: -104px; }
.received .m-actions { right: -104px; }
.m-wrap:hover .m-actions { display: flex; }

.m-act {
  background: none; border: none; cursor: pointer;
  font-size: var(--bb-text-md); padding: 5px; border-radius: 50%; transition: background 0.2s;
}
.m-act:hover { background: var(--bb-bg-subtle); }

/* Typing indicator */
.m-typing {
  align-self: flex-start;
  background: var(--bb-bg-subtle);
  padding: 13px 16px;
  border-radius: 18px;
  border-bottom-left-radius: 5px;
  display: flex; gap: 5px; align-items: center;
}
.m-dot {
  width: 7px; height: 7px; background: var(--bb-text-tertiary); border-radius: 50%;
  animation: typingBounce 1.4s infinite ease-in-out;
}
.m-dot:nth-child(2) { animation-delay: 0.2s; }
.m-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* ── INPUT AREA ── */
.m-input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--bb-border);
  display: flex; align-items: center; gap: 8px;
  background: var(--bb-surface);
  position: relative;
}
.m-ibtn {
  background: none; border: none; font-size: var(--bb-text-xl); cursor: pointer;
  padding: 6px; border-radius: 50%; transition: background 0.2s;
}
.m-ibtn:hover { background: var(--bb-bg-subtle); }
.m-input {
  flex: 1;
  padding: 10px 16px;
  border-radius: 18px;
  border: 1px solid var(--bb-border);
  font-size: var(--bb-text-base);
  outline: none;
  transition: border 0.2s;
  font-family: inherit;
  min-width: 0;
  background: var(--bb-bg-subtle);
  color: var(--bb-ink);
}
.m-input::placeholder { color: var(--bb-text-tertiary); }
.m-input:focus { border-color: var(--bb-accent); }
.m-send {
  background: var(--bb-accent); color: var(--bb-on-accent);
  border: none; padding: 9px 16px; border-radius: 18px;
  font-weight: var(--bb-weight-semibold); cursor: pointer; transition: opacity 0.2s;
  font-size: var(--bb-text-base); font-family: inherit;
}
.m-send:hover { opacity: 0.9; }
.m-send:disabled { opacity: 0.4; cursor: not-allowed; }

/* Emoji picker */
.m-emoji-picker {
  position: absolute;
  bottom: 62px;
  left: 14px;
  background: var(--bb-surface);
  border: 1px solid var(--bb-border);
  border-radius: 14px;
  box-shadow: var(--bb-shadow-md);
  padding: 12px;
  width: 300px;
  max-height: 240px;
  overflow-y: auto;
  z-index: 50;
  animation: msgIn 0.2s ease-out;
}
.m-emoji-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
.m-emoji-item {
  font-size: var(--bb-text-2xl); padding: 5px; cursor: pointer; border-radius: 8px;
  transition: background 0.2s, transform 0.2s; text-align: center;
}
.m-emoji-item:hover { background: var(--bb-bg-subtle); transform: scale(1.15); }

/* Desktop empty state */
.m-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  color: var(--bb-text-tertiary); text-align: center; padding: 20px;
}
.m-empty-emoji { font-size: var(--bb-text-4xl); }
.m-empty p { font-size: var(--bb-text-sm); margin: 0; }

/* ── MOBILE ── (fixed = viewport-anchored, wrapper is irrelevant here) */
@media (max-width: 768px) {
  .msg-pop {
    position: fixed;
    top: 72px; left: 8px; right: 8px; bottom: 8px;
  }
  .msg-pop::before { display: none; }
  .msg-panel { width: 100%; height: 100%; max-height: none; }

  .m-sidebar {
    width: 100%; min-width: 100%;
    position: absolute; inset: 0;
    z-index: 5;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .msg-app.chat-open .m-sidebar { transform: translateX(-100%); }
  .m-back { display: block; }
  .m-wrap { max-width: 85%; }
  .m-actions { display: none !important; }
  .m-emoji-picker { width: 260px; }
  .m-emoji-grid { grid-template-columns: repeat(7, 1fr); }
}
</style>