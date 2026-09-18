// Version: 1.0000
import { defineConfig } from 'vite';

// base: './' -> относителни пътища, нужни за Capacitor (WebView зарежда от file://).
// Играта е самостоятелен canvas-2D — без Node зависимости. Изображенията са в public/assets
// и се копират 1:1 в dist/assets (inline скриптът ги зарежда като 'assets/<име>').
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2017',
    chunkSizeWarningLimit: 2000
  }
});
