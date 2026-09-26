// Version: 1.0001
import { defineConfig } from 'vite';

// Vite конфигурация — офлайн-първо приложение.
// base:'./' прави всички пътища относителни, което е задължително за Capacitor
// (приложението се сервира от file:// или от вградения http сървър без коренов път).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2017',
    assetsInlineLimit: 0
  },
  // lite-gate.js зарежда src/lite.js с top-level await; es2017 не го поддържа при финалния
  // transpile, затова казваме на esbuild, че TLA е налично (WebView на Capacitor го поддържа).
  esbuild: { supported: { 'top-level-await': true } },
  server: {
    host: true,
    port: 5173
  }
});
