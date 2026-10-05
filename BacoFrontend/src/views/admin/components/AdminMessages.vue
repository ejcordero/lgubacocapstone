<template>
    <div class="msg-pop">
      <div class="msg-panel">
        <div class="msg-app" :class="{ 'chat-open': mobileChatOpen }">
  
          <!-- ── SIDEBAR ── -->
          <aside class="m-sidebar">
            <div class="m-sh">
              <h2>Messages</h2>
              <button class="m-close mat-skeuo-sm mat-pressable-sm" title="Close" @click="emit('close')">✕</button>
            </div>
            <input v-model="search" type="text" class="m-search" placeholder="Search" />
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
                <button class="m-ibtn mat-skeuo-sm mat-pressable-sm" title="Attach">+</button>
                <button class="m-ibtn m-emoji-btn mat-skeuo-sm mat-pressable-sm" title="Emoji" @click="showEmoji = !showEmoji">😊</button>
                <input
                  ref="msgInput"
                  v-model="newMessage"
                  type="text"
                  class="m-input"
                  placeholder="iMessage"
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
  
  const emit = defineEmits(['close'])
  
  // ══════════════════════════════════════════════════════════
  // DEMO DATA — frontend-only. Admin ↔ resort owners, citizens,
  // and staff. Blue bubbles = you (the admin). Swap for real
  // backend data later (conversations from hotel_owners /
  // tourism_users / halcon_permits participants).
  // ══════════════════════════════════════════════════════════
  const chats = ref([
    {
      id: 1, name: 'Kambal Bato Resort (Owner)', initials: 'KB', status: 'STAYHUB Owner', unread: 2,
      messages: [
        { id: 1, text: 'Hi po, our resort listing is still unpublished. When will the LGU review it?', type: 'received', time: '8:40 AM' },
        { id: 2, text: 'We also updated our entrance fees — do we need to resubmit anything?', type: 'received', time: '8:42 AM' },
        { id: 3, text: 'Good morning! Checking on your listing now. 👀', type: 'sent', time: '9:05 AM' },
      ]
    },
    {
      id: 2, name: 'Ellaine Joy Cordero', initials: 'EC', status: 'Citizen', unread: 1,
      messages: [
        { id: 1, text: 'Hello po, ask ko lang about my Halcon permit HLCN-2026-002. How long is the review?', type: 'received', time: 'Yesterday' },
      ]
    },
    {
      id: 3, name: 'Jerome De Lizo (Tourism Officer)', initials: 'JD', status: 'Staff', unread: 0,
      messages: [
        { id: 1, text: 'Sir, uploaded na po yung bagong bidding documents sa TALA.', type: 'received', time: 'Monday' },
        { id: 2, text: 'Great. I will verify the chain anchors later.', type: 'sent', time: 'Monday' },
      ]
    },
    {
      id: 4, name: 'Stella Belmonte (MHO Officer)', initials: 'SB', status: 'Staff', unread: 0,
      messages: [
        { id: 1, text: 'Reminder po: Halcon medical certificates batch for review by Friday.', type: 'received', time: 'Sept 2' },
      ]
    },
  ])
  
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
  
  // ── State ──
  const activeId = ref(null)
  const search = ref('')
  const newMessage = ref('')
  const typingIn = ref(null)
  const mobileChatOpen = ref(false)
  const showEmoji = ref(false)
  const copiedId = ref(null)
  
  const msgBox = ref(null)
  const msgInput = ref(null)
  let replyTimer = null
  
  // ── Derived ──
  const filteredChats = computed(() =>
    chats.value.filter(c => c.name.toLowerCase().includes(search.value.toLowerCase()))
  )
  const activeChat = computed(() => chats.value.find(c => c.id === activeId.value) || null)
  const lastMsg = (c) => c.messages.length ? c.messages[c.messages.length - 1].text : 'No messages yet'
  
  // ── Helpers ──
  const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  function scrollBottom() {
    if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight
  }
  
  // ── Interactions ──
  function openChat(c) {
    activeId.value = c.id
    c.unread = 0
    mobileChatOpen.value = true
    showEmoji.value = false
    nextTick(scrollBottom)
  }
  function backToList() { mobileChatOpen.value = false }
  
  function selectEmoji(e) {
    newMessage.value += e
    msgInput.value?.focus()
  }
  function replyFocus() { msgInput.value?.focus() }
  function toggleReact(msg) { msg.reaction = msg.reaction ? null : '❤️' }
  async function copyMsg(msg) {
    try {
      await navigator.clipboard.writeText(msg.text)
      copiedId.value = msg.id
      setTimeout(() => { copiedId.value = null }, 1200)
    } catch (e) { /* clipboard unavailable — ignore */ }
  }
  
  function send() {
    const text = newMessage.value.trim()
    if (!text || !activeChat.value) return
    activeChat.value.messages.push({ id: Date.now(), text, type: 'sent', time: now() })
    newMessage.value = ''
    showEmoji.value = false
    nextTick(scrollBottom)
    simulateReply(activeChat.value.id)
  }
  
  function simulateReply(chatId) {
    clearTimeout(replyTimer)
    typingIn.value = chatId
    nextTick(scrollBottom)
    const delay = 1200 + Math.random() * 1400
    replyTimer = setTimeout(() => {
      typingIn.value = null
      const chat = chats.value.find(c => c.id === chatId)
      if (!chat) return
      const replies = [
        'Noted po, thank you!',
        'Sige po, we will wait for the update. 🙏',
        'Understood. Following up next week if wala pa po.',
        'Copy po, thank you sa response!',
        'Got it po 👍',
        'Okay po, appreciated! 😊',
      ]
      chat.messages.push({
        id: Date.now(),
        text: replies[Math.floor(Math.random() * replies.length)],
        type: 'received',
        time: now(),
      })
      nextTick(scrollBottom)
    }, delay)
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
  })
  onUnmounted(() => {
    document.removeEventListener('mousedown', onDocMousedown)
    document.removeEventListener('keydown', onKeydown)
    clearTimeout(replyTimer)
  })
  </script>
  
  <style scoped>
  /* iMessage palette — hardcoded deliberately so the admin theme's
     dark variables never bleed into this popup. */
  
  /* Fixed to the viewport so it anchors correctly below the admin
     top bar regardless of where the component is mounted (and immune
     to the top-bar's backdrop-filter re-anchoring). */
  .msg-pop {
    position: fixed;
    top: calc(var(--header-h, 66px) + 4px);
    right: 16px;
    z-index: 200;
  }
  /* Caret connecting the popup to the envelope button.
     Envelope center ≈ 94px from viewport right (24 padding + 40 gear
     + 10 gap + 20 half-envelope); popup right edge is 16px in, so the
     caret sits at ~71px. Nudge a few px if visually off. */
  .msg-pop::before {
    content: '';
    position: absolute;
    top: -7px;
    right: 71px;
    width: 14px;
    height: 14px;
    background: var(--card-solid);
    border-left: 1px solid var(--bdr2);
    border-top: 1px solid var(--bdr2);
    transform: rotate(45deg);
    border-radius: 3px;
  }
  
  .msg-panel {
    width: min(720px, calc(100vw - 32px));
    height: 520px;
    max-height: calc(100vh - 100px);
    background: var(--card-solid);
    border: 1px solid var(--bdr2);
    border-radius: 18px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
    overflow: hidden;
    animation: popIn 0.25s cubic-bezier(0.22, 1, 0.36, 1);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
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
    background: var(--card-solid);
    border-right: 1px solid var(--bdr2);
    display: flex;
    flex-direction: column;
  }
  .m-sh {
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--bdr2);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .m-sh h2 { font-size: 19px; font-weight: 700; margin: 0; color: #000; }
  .m-close { border-radius: 8px; width: 26px; height: 26px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .m-close:hover { background: var(--bdr2); color: #000; }
  
  .m-search {
    margin: 12px;
    padding: 9px 14px;
    border-radius: 10px;
    border: none;
    background: var(--card2);
    font-size: 14px;
    outline: none;
    font-family: inherit;
  }
  .m-list { flex: 1; overflow-y: auto; }
  
  .m-item {
    display: flex; align-items: center;
    padding: 11px 16px;
    cursor: pointer;
    transition: background 0.2s;
    border-bottom: 1px solid var(--card2);
  }
  .m-item:hover { background: var(--card2); }
  .m-item.active { background: var(--ac-soft); }
  
  .m-avatar {
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 600; font-size: 15px;
    margin-right: 12px; flex-shrink: 0;
  }
  .m-item-info { flex: 1; min-width: 0; }
  .m-item-name {
    font-weight: 600; font-size: 14px; margin-bottom: 3px; color: #000;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .m-unread {
    min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
    background: #007aff; color: #fff; font-size: 10px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .m-item-preview {
    font-size: 12.5px; color: #8e8e93;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .m-noresults { padding: 24px 16px; font-size: 13px; color: #8e8e93; text-align: center; }
  
  /* ── CHAT AREA ── */
  .m-chat {
    flex: 1; display: flex; flex-direction: column;
    background: #fff; min-width: 0;
  }
  .m-chat-header {
    padding: 12px 18px;
    border-bottom: 1px solid var(--bdr2);
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(255,255,255,0.95);
  }
  .m-ch-left { display: flex; align-items: center; flex: 1; }
  .m-back {
    display: none;
    background: none; border: none; font-size: 22px; cursor: pointer;
    margin-right: 12px; color: #007aff; padding: 0 4px; line-height: 1;
  }
  .m-ch-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 600; font-size: 13px; margin-right: 11px;
  }
  .m-ch-info h3 { font-size: 15px; font-weight: 600; margin: 0; color: #000; }
  .m-ch-status { font-size: 12px; color: #34c759; }
  
  /* ── MESSAGES ── */
  .m-msgs {
    flex: 1; overflow-y: auto;
    padding: 18px 20px;
    display: flex; flex-direction: column; gap: 6px;
    background: #fff;
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
    font-size: 14.5px;
    line-height: 1.4;
    word-wrap: break-word;
  }
  .sent .m-bubble { background: #007aff; color: #fff; border-bottom-right-radius: 5px; }
  .received .m-bubble { background: var(--bdr2); color: #000; border-bottom-left-radius: 5px; }
  
  .m-reaction { font-size: 12px; margin-top: 2px; padding: 0 6px; }
  .m-time { font-size: 10.5px; color: #8e8e93; margin-top: 3px; padding: 0 6px; }
  
  .m-actions {
    display: none;
    position: absolute;
    top: 50%; transform: translateY(-50%);
    background: #fff;
    border-radius: 18px;
    box-shadow: 0 2px 15px rgba(0,0,0,0.15);
    padding: 4px;
    gap: 2px;
    z-index: 5;
  }
  .sent .m-actions { left: -104px; }
  .received .m-actions { right: -104px; }
  .m-wrap:hover .m-actions { display: flex; }
  
  .m-act {
    background: none; border: none; cursor: pointer;
    font-size: 15px; padding: 5px; border-radius: 50%; transition: background 0.2s;
  }
  .m-act:hover { background: var(--card2); }
  
  /* Typing indicator */
  .m-typing {
    align-self: flex-start;
    background: var(--bdr2);
    padding: 13px 16px;
    border-radius: 18px;
    border-bottom-left-radius: 5px;
    display: flex; gap: 5px; align-items: center;
  }
  .m-dot {
    width: 7px; height: 7px; background: #999; border-radius: 50%;
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
    border-top: 1px solid var(--bdr2);
    display: flex; align-items: center; gap: 8px;
    background: #fff;
    position: relative;
  }
  .m-ibtn { font-size: 20px; cursor: pointer; padding: 6px; border-radius: 50%; }
  .m-ibtn:hover { background: var(--card2); }
  .m-input {
    flex: 1;
    padding: 10px 16px;
    border-radius: 18px;
    border: 1px solid var(--bdr2);
    font-size: 14px;
    outline: none;
    transition: border 0.2s;
    font-family: inherit;
    min-width: 0;
  }
  .m-input:focus { border-color: #007aff; }
  .m-send {
    background: #007aff; color: #fff;
    border: none; padding: 9px 16px; border-radius: 18px;
    font-weight: 600; cursor: pointer; transition: opacity 0.2s;
    font-size: 14px; font-family: inherit;
  }
  .m-send:hover { opacity: 0.9; }
  .m-send:disabled { opacity: 0.4; cursor: not-allowed; }
  
  /* Emoji picker */
  .m-emoji-picker {
    position: absolute;
    bottom: 62px;
    left: 14px;
    background: #fff;
    border: 1px solid var(--bdr2);
    border-radius: 14px;
    box-shadow: 0 5px 25px rgba(0,0,0,0.2);
    padding: 12px;
    width: 300px;
    max-height: 240px;
    overflow-y: auto;
    z-index: 50;
    animation: msgIn 0.2s ease-out;
  }
  .m-emoji-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
  .m-emoji-item {
    font-size: 22px; padding: 5px; cursor: pointer; border-radius: 8px;
    transition: background 0.2s, transform 0.2s; text-align: center;
  }
  .m-emoji-item:hover { background: var(--card2); transform: scale(1.15); }
  
  /* Desktop empty state */
  .m-empty {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 10px;
    color: #8e8e93; text-align: center; padding: 20px;
  }
  .m-empty-emoji { font-size: 2.4rem; }
  .m-empty p { font-size: 13.5px; margin: 0; }
  
  /* ── MOBILE ── */
  @media (max-width: 768px) {
    .msg-pop {
      top: calc(var(--header-h, 66px) + 4px);
      left: 8px; right: 8px; bottom: 8px;
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