// Version: 1.0001
import { defineConfig } from 'vite';

// Конфигурация на Vite.
// base: './' -> относителни пътища, нужни за Capacitor (WebView зарежда от file://).
// TF.js е голям; lazy-load-ва се с динамичен import(), затова големият chunk е очакван.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5196
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2017',
    // Големият TF.js chunk е очакван (lazy-load). Вдигаме прага само за предупреждението.
    chunkSizeWarningLimit: 4000
  }
});
