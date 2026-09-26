// Version: 1.0001
import { defineConfig } from 'vite';

// Конфигурация на Vite.
// base: './' -> относителни пътища, нужни за Capacitor (WebView зарежда от file://).
// TF.js е голям → lazy-load с динамичен import() (виж src/core/recognizer.js), затова
// chunk warning-ът от build е очакван и безобиден.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5197
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2017',
    chunkSizeWarningLimit: 4000
  }
});
