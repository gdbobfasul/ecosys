import { defineConfig } from 'vite';

// Vite конфигурация — самостоятелно мобилно приложение.
// base:'./' прави всички пътища относителни, което е задължително за Capacitor
// (уеб слоят се сервира от file:// или вградения http сървър без коренов път).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2017',
    assetsInlineLimit: 0
  },
  server: {
    host: true,
    port: 5173
  }
});
