// Version: 1.0001
import { defineConfig } from 'vite';

// base: './' -> относителни пътища, нужни за Capacitor (WebView зарежда от file://).
// Видеата живеят в public/assets/ и се сервират/копират as-is (без хеширане),
// затова движковите URL-и от вида assets/animations/... работят и в dev, и в билда.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2017'
  }
});
