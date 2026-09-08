import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Bind to all interfaces so the dev server is reachable from a phone
    // on the same Wi-Fi network, not just localhost.
    host: true,
  },
})
