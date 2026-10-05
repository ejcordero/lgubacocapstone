import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const proxy = {
  // MUST come first: chat goes to the Chat API (3001)
  '/api/chat': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
  // everything else under /api goes to the Backend (3000)
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
  '/downloads': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: process.env.PORT || 5173,
      host: true,
      allowedHosts: true,
      proxy,
    },
    // Used when start.js runs in production (vite preview)
    preview: {
      port: process.env.PORT || 5173,
      host: true,
      allowedHosts: true,
      proxy,
    },
    define: {
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    }
  }
})