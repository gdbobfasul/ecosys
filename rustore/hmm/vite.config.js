import { defineConfig } from 'vite';

// base: './' -> относителни пътища, нужни за Capacitor (WebView зарежда от file://).
// Файловете в public/ (включително assets/animations/HMM/*.webm) се копират as-is в dist/.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5174
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2019',
    // .webm видеата са много и големи — не предупреждавай за размера на бъндъла.
    chunkSizeWarningLimit: 4096
  }
});
