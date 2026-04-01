import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensure SW and public assets are served correctly in dev
  server: {
    headers: {
      'Service-Worker-Allowed': '/',
    },
  },
  build: {
    // Generate sourcemaps for easier debugging
    sourcemap: false,
    rollupOptions: {
      output: {
        // Stable chunk names for better caching
        manualChunks: undefined,
      },
    },
  },
});
