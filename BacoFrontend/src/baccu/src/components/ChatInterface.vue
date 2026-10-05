<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import {
  Send as SendIcon,
  User as UserIcon,
  Bot as BotIcon,
  Info as InfoIcon,
  Key as KeyIcon
} from 'lucide-vue-next';

const messages = ref([
  {
    role: 'model',
    text: "Mabuhay! I'm BACCU, your official Baco Municipality AI Assistant.\n\nI can help you with:\n• Municipal services & government info\n• Tourist attractions & local spots\n• Community events & history\n\nHow may I assist you today?"
  }
]);

const input = ref('');
const isLoading = ref(false);
const messagesEndRef = ref(null);
const inputRef = ref(null);
const showKeyButton = ref(false);

const scrollToBottom = async () => {
  await nextTick();
  if (messagesEndRef.value) {
    messagesEndRef.value.scrollIntoView({ behavior: 'smooth' });
  }
};

watch(messages, scrollToBottom, { deep: true });
onMounted(scrollToBottom);

const handleOpenKeySelector = () => {
  console.log('API key selector would open here');
};

const handleSend = async () => {
  if (!input.value.trim() || isLoading.value) return;
  const userMessage = input.value.trim();
  input.value = '';

  messages.value.push({ role: 'user', text: userMessage });
  isLoading.value = true;

  try {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage })
    });

    const data = await response.json();

    messages.value.push({
      role: 'model',
      text: data.reply || "Sorry, I couldn't get a response. Please try again."
    });

  } catch (error) {
    console.error("Chat error:", error);
    messages.value.push({
      role: 'model',
      text: "I'm having trouble connecting. Make sure the server is running.",
      isError: true
    });
  } finally {
    isLoading.value = false;
  }
};

const quickSuggestions = ['Tell me about Baco', 'Tourist spots', 'Municipal services', 'Who is the Mayor?'];

const handleKeyPress = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

const isFirstInGroup = (idx) => idx === 0 || messages.value[idx - 1].role !== messages.value[idx].role;
const isLastInGroup = (idx) => idx === messages.value.length - 1 || messages.value[idx + 1].role !== messages.value[idx].role;
</script>

<template>
  <div class="baccu-chat">
    <!-- Header -->
    <div class="baccu-header">
      <div class="header-left">
        <div class="avatar-ring">
          <div class="avatar-inner">
            <img src="/images/BACO-SEAL.png" alt="Baco Logo" class="header-logo" />
          </div>
        </div>
        <div class="header-text">
          <div class="header-title">BACCU</div>
          <div class="header-sub">
            <span class="status-dot"></span>
            Baco Municipal AI
          </div>
        </div>
      </div>
      <button class="info-btn" title="About BACCU">
        <InfoIcon :size="15" />
      </button>
    </div>

    <!-- Messages -->
    <div class="messages-area">
      <!-- Suggestions (show when only initial message) -->
      <div v-if="messages.length <= 1" class="suggestions-row">
        <button
          v-for="s in quickSuggestions"
          :key="s"
          @click="input = s; handleSend()"
          class="suggestion-chip"
        >{{ s }}</button>
      </div>

      <TransitionGroup name="msg" tag="div" class="messages-list">
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="message-row"
          :class="[msg.role === 'user' ? 'user-row' : 'bot-row', { 'first-in-group': isFirstInGroup(idx) }]"
        >
          <!-- Bot avatar -->
          <div v-if="msg.role === 'model'" class="msg-avatar bot-avatar" :class="{ invisible: !isFirstInGroup(idx) }">
            <BotIcon :size="13" />
          </div>

          <div
            class="bubble"
            :class="[
              msg.role === 'user' ? 'user-bubble' : 'bot-bubble',
              msg.isError ? 'error-bubble' : '',
              isFirstInGroup(idx) && msg.role === 'model' ? 'first-bot' : '',
              isLastInGroup(idx) && msg.role === 'user' ? 'last-user' : ''
            ]"
          >
            <div class="bubble-text">
              <template v-for="(line, i) in msg.text.split('\n')" :key="i">
                <span>{{ line }}</span>
                <br v-if="i < msg.text.split('\n').length - 1" />
              </template>
            </div>
            <button
              v-if="msg.isError && showKeyButton"
              @click="handleOpenKeySelector"
              class="key-btn"
            >
              <KeyIcon :size="11" /> Select API Key
            </button>
          </div>

          <!-- User avatar -->
          <div v-if="msg.role === 'user'" class="msg-avatar user-avatar" :class="{ invisible: !isFirstInGroup(idx) }">
            <UserIcon :size="13" />
          </div>
        </div>
      </TransitionGroup>

      <!-- Typing indicator -->
      <div v-if="isLoading" class="message-row bot-row first-in-group typing-row">
        <div class="msg-avatar bot-avatar"><BotIcon :size="13" /></div>
        <div class="bubble bot-bubble first-bot typing-bubble">
          <span></span><span></span><span></span>
        </div>
      </div>

      <div ref="messagesEndRef" style="height:1px" />
    </div>

    <!-- Input -->
    <div class="input-area">
      <div class="input-wrapper">
        <input
          ref="inputRef"
          v-model="input"
          @keypress="handleKeyPress"
          placeholder="Ask BACCU anything…"
          class="chat-input"
          :disabled="isLoading"
        />
        <button
          @click="handleSend"
          :disabled="!input.trim() || isLoading"
          class="send-btn"
          :class="{ active: input.trim() && !isLoading }"
        >
          <SendIcon :size="15" />
        </button>
      </div>
     <div class="input-footer">Official Baco LGU</div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@600&display=swap');

/* ── Root ── */
.baccu-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #fafaf9;
  overflow: hidden;
  font-family: 'DM Sans', sans-serif;
}

/* ── Header ── */
.baccu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, #0b1d35 0%, #1a3560 100%);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.baccu-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 80% 50%, rgba(201,168,76,0.18) 0%, transparent 60%);
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}
.avatar-ring {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c9a84c, #e8c96a);
  padding: 2px;
  flex-shrink: 0;
}
.avatar-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.header-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
  padding: 3px;
}
.header-title {
  font-family: 'Playfair Display', serif;
  font-size: 17px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.5px;
  line-height: 1;
}
.header-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: #c9a84c;
  margin-top: 2px;
  font-weight: 400;
  opacity: 0.9;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.info-btn {
  position: relative;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.6);
  border-radius: 8px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.info-btn:hover {
  background: rgba(201,168,76,0.2);
  color: #c9a84c;
  border-color: rgba(201,168,76,0.3);
}

/* ── Messages Area ── */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 8px;
  scroll-behavior: smooth;
  background:
    radial-gradient(ellipse at 10% 0%, rgba(11,29,53,0.03) 0%, transparent 50%),
    #fafaf9;
}
.messages-area::-webkit-scrollbar { width: 4px; }
.messages-area::-webkit-scrollbar-track { background: transparent; }
.messages-area::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }

/* ── Suggestions ── */
.suggestions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.suggestion-chip {
  padding: 5px 11px;
  border-radius: 20px;
  border: 1.5px solid rgba(11,29,53,0.12);
  background: white;
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  color: #0b1d35;
  cursor: pointer;
  transition: all 0.18s;
  font-weight: 500;
}
.suggestion-chip:hover {
  border-color: #c9a84c;
  background: rgba(201,168,76,0.06);
  color: #0b1d35;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(201,168,76,0.15);
}

/* ── Message Rows ── */
.messages-list { display: flex; flex-direction: column; gap: 2px; }
.message-row {
  display: flex;
  align-items: flex-end;
  gap: 7px;
}
.message-row.first-in-group { margin-top: 10px; }
.user-row { flex-direction: row-reverse; }
.bot-row { flex-direction: row; }

/* ── Avatars ── */
.msg-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.msg-avatar.invisible { visibility: hidden; }
.bot-avatar { background: linear-gradient(135deg, rgba(201,168,76,0.2), rgba(201,168,76,0.1)); color: #a07c2a; }
.user-avatar { background: linear-gradient(135deg, #0b1d35, #1a3560); color: rgba(255,255,255,0.7); }

/* ── Bubbles ── */
.bubble {
  max-width: 76%;
  padding: 9px 13px;
  border-radius: 16px;
  font-size: 12.5px;
  line-height: 1.6;
  word-break: break-word;
}
.bot-bubble {
  background: white;
  color: #1a2b45;
  border: 1px solid rgba(11,29,53,0.08);
  box-shadow: 0 1px 4px rgba(11,29,53,0.06);
}
.first-bot { border-top-left-radius: 4px; }
.user-bubble {
  background: linear-gradient(135deg, #0b1d35, #1a3a6e);
  color: white;
  box-shadow: 0 2px 10px rgba(11,29,53,0.25);
}
.last-user { border-bottom-right-radius: 4px; }
.error-bubble {
  background: #fff5f5;
  border-color: rgba(192,57,43,0.2);
  color: #c0392b;
}
.bubble-text { white-space: pre-wrap; }

/* ── Typing indicator ── */
.typing-bubble {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  min-width: 52px;
}
.typing-bubble span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c9a84c;
  opacity: 0.5;
  animation: typing 1.2s ease-in-out infinite;
}
.typing-bubble span:nth-child(2) { animation-delay: 0.2s; }
.typing-bubble span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-3px); }
}

/* ── Key button ── */
.key-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 5px 10px;
  background: #c0392b;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: background 0.18s;
}
.key-btn:hover { background: #991b1b; }

/* ── Input Area ── */
.input-area {
  padding: 10px 14px 12px;
  background: white;
  border-top: 1px solid rgba(11,29,53,0.07);
  flex-shrink: 0;
}
.input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #f4f5f7;
  border-radius: 14px;
  border: 1.5px solid transparent;
  padding: 5px 5px 5px 14px;
  transition: all 0.2s;
}
.input-wrapper:focus-within {
  border-color: #c9a84c;
  background: white;
  box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
}
.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 12.5px;
  font-family: 'DM Sans', sans-serif;
  color: #0b1d35;
  min-width: 0;
}
.chat-input::placeholder { color: #9ca3af; }
.send-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(11,29,53,0.08);
  color: #9ca3af;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.send-btn.active {
  background: linear-gradient(135deg, #0b1d35, #1a3a6e);
  color: white;
  box-shadow: 0 3px 10px rgba(11,29,53,0.3);
}
.send-btn.active:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 14px rgba(11,29,53,0.35);
}
.send-btn:disabled { cursor: not-allowed; }
.input-footer {
  text-align: center;
  font-size: 10px;
  color: #b0b9c8;
  margin-top: 7px;
  letter-spacing: 0.2px;
}

/* ── Transitions ── */
.msg-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.msg-enter-from { opacity: 0; transform: translateY(12px) scale(0.96); }
.msg-leave-active { transition: all 0.18s ease; }
.msg-leave-to { opacity: 0; transform: translateY(-4px); }
</style>