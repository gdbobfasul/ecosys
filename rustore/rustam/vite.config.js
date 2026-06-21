import { defineConfig } from 'vite';

// Конфигурация на Vite.
// base: './' -> относителни пътища, нужни за Capacitor (WebView зарежда от file://).
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5176
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2017'
  }
});
