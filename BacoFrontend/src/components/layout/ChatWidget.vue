<template>
  <Teleport to="body">
    <div class="chat-widget">
      <div v-if="isOpen" class="chat-widget-container">
        <ChatInterface />
      </div>
      <button 
        class="chat-widget-button" 
        @click="toggleChat"
        :aria-label="isOpen ? 'Close Chat' : 'Open Chat'"
        :title="isOpen ? 'Close Chat' : 'Open Chat'"
      >
        <div class="icon-wrapper" :class="{ 'is-open': isOpen }">
          <svg v-if="!isOpen" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import ChatInterface from '../../baccu/src/components/ChatInterface.vue'

const isOpen = ref(false)
const toggleChat = () => {
  isOpen.value = !isOpen.value
}
</script>

<style scoped>
/* pointer-events: none on wrapper — only children opt back in */
.chat-widget {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 20px;
  user-select: none;
  pointer-events: none; /* 👈 entire widget area is click-through */
}

.chat-widget-button {
  pointer-events: all; /* 👈 only the button is clickable */
  width: 64px;
  height: 64px;
  background-color: #0B198F;
  color: #FFFFFF;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(11, 25, 143, 0.25);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.chat-widget-button:hover {
  background-color: #CE1126;
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(206, 17, 38, 0.3);
}

.chat-widget-button:active {
  transform: translateY(0) scale(0.95);
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.icon-wrapper.is-open {
  transform: rotate(90deg);
}

.chat-widget-container {
  pointer-events: all; /* 👈 chat panel is fully interactive when open */
  width: 400px;
  height: 600px;
  max-height: calc(100vh - 120px);
  background-color: #FFFFFF;
  border-radius: 12px;
  border: 1px solid rgba(11, 25, 143, 0.1);
  border-top: 4px solid #0B198F;
  box-shadow: 0 20px 40px rgba(11, 25, 143, 0.15);
  overflow: hidden;
  transform-origin: bottom right;
  animation: popIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@media (max-width: 768px) {
  .chat-widget {
    bottom: 20px;
    right: 20px;
    gap: 16px;
  }

  .chat-widget-button {
    width: 56px;
    height: 56px;
  }

  .chat-widget-button svg {
    width: 24px;
    height: 24px;
  }

  .chat-widget-container {
    width: calc(100vw - 40px);
    height: calc(100vh - 120px);
  }
}
</style>