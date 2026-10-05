<!-- src/views/AuthView.vue -->
<script setup>
import { ref } from 'vue'
import AuthModal from '@/components/auth/AuthModal.vue'

const showAuth = ref(true)
</script>

<template>
  <div class="auth-view">
    <AuthModal v-if="showAuth" @close="showAuth = false" />
  </div>
</template>