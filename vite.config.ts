import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import pkg from './package.json';

export default defineConfig({
  plugins: [
    // Split route components into their own chunks so the initial payload only
    // carries the route being rendered.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Vite inlines assets under 4 kB as data: URIs. The deployed CSP uses
    // `font-src 'self'`, so an inlined font subset is blocked and logs a
    // violation on every load. Keep font files as hashed assets instead of
    // widening the policy to allow data: fonts.
    assetsInlineLimit: (filePath) =>
      /\.(?:woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined,
  },
});
