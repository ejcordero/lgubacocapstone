<script setup>
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: 'Modal' },
  size: { type: String, default: 'md' } // sm, md, lg
});

const emit = defineEmits(['close']);

const handleKeydown = (e) => {
  if (e.key === 'Escape') emit('close');
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  document.body.style.overflow = 'hidden';
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
});

const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) emit('close');
};
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleBackdropClick">
      <div class="modal" :class="size">
        <div class="modal-header">
          <h3>{{ title }}</h3>
          <button class="close" @click="emit('close')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <slot></slot>
        </div>
        <div v-if="$slots.footer" class="modal-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0,0,0,.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  background: var(--card);
  border: 1px solid var(--bdr);
  border-radius: 20px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  animation: modalIn .4s cubic-bezier(.22,1,.36,1);
}

.modal.sm { max-width: 400px; }
.modal.md { max-width: 520px; }
.modal.lg { max-width: 720px; }

@keyframes modalIn {
  from { opacity: 0; transform: scale(.9) translateY(24px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-header {
  padding: 18px 22px;
  border-bottom: 1px solid var(--bdr);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  font-family: 'Unbounded', sans-serif;
  font-size: 17px;
  font-weight: 700;
  color: var(--fg);
  margin: 0;
  letter-spacing: -0.02em;
}

.close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--bg2);
  border: 1px solid var(--bdr);
  color: var(--mt);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all .2s;
}

.close:hover {
  border-color: var(--dg);
  color: var(--dg);
  background: var(--dgg);
}

.modal-body {
  padding: 22px;
}

.modal-footer {
  padding: 16px 22px;
  border-top: 1px solid var(--bdr);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Transitions */
.modal-enter-active {
  animation: overlayIn .3s ease;
}

.modal-leave-active {
  animation: overlayOut .3s ease forwards;
}

@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes overlayOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Scrollbar */
.modal::-webkit-scrollbar { width: 6px; }
.modal::-webkit-scrollbar-thumb { background: var(--bdr2); border-radius: 3px; }
</style>