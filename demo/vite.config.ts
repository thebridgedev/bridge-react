import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    fs: {
      // Allow serving files from the library source during dev
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        path.resolve(__dirname, '../bridge-react/src'),
        path.resolve(__dirname, '../bridge-react')
      ]
    }
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true
  },
  build: {
    rollupOptions: {
      // `@stripe/stripe-js` is an optional peer the plugin's <PlanSelector>
      // dynamically imports only for hosted Stripe Checkout. The demo uses free
      // plans, so it isn't installed — externalize it so the production build
      // doesn't fail trying to resolve it (matches the plugin's rollup external).
      external: ['@stripe/stripe-js']
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Consume library source directly in dev (Svelte-style DX)
      '@nebulr-group/bridge-react': path.resolve(__dirname, '../bridge-react/src')
    }
  },
  optimizeDeps: {
    // Ensure Vite treats the lib as source, not prebundled
    exclude: ['@nebulr-group/bridge-react']
  }
});
