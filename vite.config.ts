import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: ['.onrender.com']
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5174,
    allowedHosts: ['.onrender.com']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
          ui: ['framer-motion', 'lucide-react', 'clsx', 'tailwind-merge'],
          docs: ['jspdf', 'docx'],
          markdown: ['react-markdown', 'remark-gfm']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
