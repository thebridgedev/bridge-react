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
