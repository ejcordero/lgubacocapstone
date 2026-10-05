<template>
  <div class="room-card">
    <img :src="room.image" :alt="room.name" class="room-img" />
    <div class="room-info p-sm">
      <div class="flex-between mb-sm">
        <h4 class="fw-bold">{{ room.name }}</h4>
        <span class="text-danger fw-bold">₱{{ room.price }}</span>
      </div>
      <p class="text-xs text-muted mb-md">
        <Users size="12" />
        Up to {{ room.capacity }} Guests
      </p>
      <button 
        @click="handleSelectRoom"
        class="clay-btn blue sm w-full"
      >
        Select & Book
      </button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { 
  Users, 
  ChevronRight, Loader2 
} from 'lucide-vue-next';

const props = defineProps({
  room: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['select-room']);

const handleSelectRoom = () => {
  emit('select-room', props.room.id);
};
</script>

<style scoped>
.room-card {
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--sand);
  transition: 0.2s;
  cursor: pointer;
}

.room-card:hover {
  border-color: var(--bb-accent);
}

.room-img {
  width: 100%;
  height: 8rem;
  object-fit: cover;
}

.room-info {
  padding: 1rem;
}

.room-info h4 {
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-bold);
  margin-bottom: 0.5rem;
}

.room-info .text-danger {
  font-size: var(--bb-text-xl);
}

.text-xs {
  font-size: var(--bb-text-xs);
}

.text-muted {
  color: var(--c-muted);
}

.fw-bold {
  font-weight: var(--bb-weight-bold);
}

/* Clay Button */
.clay-btn {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  font-weight: var(--bb-weight-bold);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  box-shadow: var(--bb-shadow-sm);
}

.clay-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--bb-shadow-md); transform: translateY(-1px);
}

.clay-btn.sm {
  padding: 0.5rem 1rem;
  font-size: var(--bb-text-base);
  border-radius: var(--radius-sm);
}
</style>
