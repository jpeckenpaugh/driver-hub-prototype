import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' || process.env.NODE_ENV === 'production' ? '/driver-hub-prototype/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@driver-hub/shared': path.resolve(__dirname, '../shared/src')
    }
  },
  server: {
    port: 5173,
    host: true
  }
});
