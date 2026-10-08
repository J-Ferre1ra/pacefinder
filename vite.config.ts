import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  // O plugin executa a API no runtime Workers também durante o desenvolvimento local.
  plugins: [react(), cloudflare()],
  server: {
    // Permite que outros dispositivos na mesma rede local abram o protótipo.
    host: '0.0.0.0',
  },
})
