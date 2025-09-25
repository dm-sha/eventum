import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true, // Не переключаться на другой порт, если 5173 занят
    host: true, // Позволяет доступ с других устройств в локальной сети
  },
  define: {
    // Определяем переменные окружения для TypeScript
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
})
