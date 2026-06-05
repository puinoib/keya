import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import pkg from './package.json';

// TODO: add vite-plugin-pwa for offline support
// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react' }),
    react(),
    tailwindcss(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   manifest: false, // uses public/manifest.json
    // }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
