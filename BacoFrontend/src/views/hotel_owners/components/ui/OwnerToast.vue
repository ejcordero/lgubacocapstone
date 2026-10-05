<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  message: { type: String, required: true },
  type: { type: String, default: 'info' }, // success, error, warning, info
  duration: { type: Number, default: 4000 }
});

const emit = defineEmits(['close']);

const visible = ref(true);

const icons = {
  success: 'fa-check',
  error: 'fa-times',
  warning: 'fa-exclamation',
  info: 'fa-info'
};

onMounted(() => {
  setTimeout(() => {
    visible.value = false;
    setTimeout(() => emit('close'), 400);
  }, props.duration);
});

const close = () => {
  visible.value = false;
  setTimeout(() => emit('close'), 400);
};
</script>

<template>
  <Transition name="toast">
    <div v-if="visible" class="toast" :class="type">
      <div class="icon">
        <i :class="'fas ' + icons[type]"></i>
      </div>
      <div class="content">
        <div class="title">{{ type.charAt(0).toUpperCase() + type.slice(1) }}</div>
        <div class="message">{{ message }}</div>
      </div>
      <button class="close" @click="close">
        <i class="fas fa-times"></i>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-radius: 12px;
  background: var(--card);
  border: 1px solid var(--bdr);
  box-shadow: 0 16px 48px rgba(0,0,0,.5);
  min-width: 280px;
  max-width: 400px;
}

.toast.success { border-left: 3px solid var(--ok); }
.toast.error { border-left: 3px solid var(--dg); }
.toast.warning { border-left: 3px solid var(--wn); }
.toast.info { border-left: 3px solid var(--ac); }

.icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.toast.success .icon { background: var(--okg); color: var(--ok); }
.toast.error .icon { background: var(--dgg); color: var(--dg); }
.toast.warning .icon { background: var(--wng); color: var(--wn); }
.toast.info .icon { background: var(--acs); color: var(--ac); }

.content { flex: 1; }
.title { font-size: 13px; font-weight: 700; color: var(--fg); }
.message { font-size: 11px; color: var(--mt); margin-top: 2px; }

.close {
  background: none;
  border: none;
  color: var(--mt);
  cursor: pointer;
  font-size: 13px;
  padding: 3px;
  transition: color .2s;
}

.close:hover { color: var(--fg); }

/* Transitions */
.toast-enter-active {
  animation: toastIn .5s cubic-bezier(.22,1,.36,1);
}

.toast-leave-active {
  animation: toastOut .4s ease forwards;
}

@keyframes toastIn {
  0% { opacity: 0; transform: translateX(120px) scale(.9); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
}

@keyframes toastOut {
  0% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; transform: translateX(120px); }
}
</style>