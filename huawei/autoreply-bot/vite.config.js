// Version: 1.0001
import { defineConfig } from 'vite';

// Конфигурация на Vite.
// base: './' -> относителни пътища, нужни за Capacitor (WebView зарежда от file://).
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5182
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2017'
  }
});
