import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Permite que outros dispositivos na mesma rede local abram o protótipo.
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
