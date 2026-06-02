import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// TODO: add vite-plugin-pwa for offline support
// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   manifest: false, // uses public/manifest.json
    // }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
