<template>
  <div class="member-form">
    <span class="roster-badge">
      {{ isLeader ? 'Team Leader' : `Member ${memberIndex + 1}` }}
    </span>
    <div class="grid-3 mt-sm gap-sm">
      <div class="form-group sm">
        <label>Full Name</label>
        <input 
          type="text" 
          v-model="member.name" 
          required 
          class="clay-input sm"
        />
      </div>
      <div class="form-group sm">
        <label>Age</label>
        <input 
          type="number" 
          v-model="member.age" 
          required 
          class="clay-input sm"
        />
      </div>
      <div class="form-group sm">
        <label>Contact</label>
        <input 
          type="text" 
          v-model="member.contact" 
          required 
          class="clay-input sm"
        />
      </div>
      <div class="form-group sm col-span-2">
        <label>Emergency Contact</label>
        <input 
          type="text" 
          v-model="member.emergency" 
          required 
          class="clay-input sm"
        />
      </div>
      <div class="form-group sm">
        <label>Medical Conditions</label>
        <input 
          type="text" 
          v-model="member.medCondition" 
          class="clay-input sm"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  member: {
    type: Object,
    required: true
  },
  memberIndex: {
    type: Number,
    required: true
  },
  isLeader: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped>
.member-form {
  padding: 1.25rem;
  background: var(--sand);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  position: relative;
}

.roster-badge {
  position: absolute;
  top: -0.75rem;
  left: 1rem;
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-bold);
  color: var(--c-muted);
  margin-left: 0.5rem;
}

.clay-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--bb-surface);
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  box-shadow: var(--bb-shadow-md);
  outline: none;
  transition: border-color 0.2s;
}

.clay-input:focus {
  border-color: var(--bb-accent); box-shadow: var(--bb-ring);
}

.clay-input.sm {
  padding: 0.5rem 0.75rem;
  font-size: var(--bb-text-base);
}

.col-span-2 {
  grid-column: span 2;
}

@media (max-width: 768px) {
  .grid-3 { grid-template-columns: 1fr; }
  .col-span-2 { grid-column: span 1; }
}
</style>
