// Version: 1.0001
import { defineConfig } from 'vite';

// Vite конфигурация — самостоятелно мобилно приложение.
// base:'./' прави всички пътища относителни, което е задължително за Capacitor
// (уеб слоят се сервира от file:// или вградения http сървър без коренов път).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',   // Transformers.js ползва BigInt литерали — es2017 гърми
    assetsInlineLimit: 0
  },
  optimizeDeps: { exclude: ['@xenova/transformers'] },
  server: {
    host: true,
    port: 5173
  }
});
