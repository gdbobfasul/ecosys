// Version: 1.0001
import { defineConfig } from 'vite';

// Конфигурация на Vite.
// base: './' -> относителни пътища, нужни за Capacitor (WebView зарежда от file://).
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5194
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    // es2020: нужно за BigInt литералите на Transformers.js (Whisper on-device). Модерните Android
    // WebView (вкл. Huawei) поддържат es2020.
    target: 'es2020'
  },
  // Transformers.js/onnxruntime-web ползват eval + голям пакет → не ги пре-оптимизирай (по-бърз, чист билд).
  optimizeDeps: { exclude: ['@xenova/transformers'] },
  worker: { format: 'es' }
});
