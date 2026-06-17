import { defineConfig } from 'vite';

// Конфигурация на Vite.
// base: './' -> относителни пътища, нужни за Capacitor (WebView зарежда от file://).
// sql.js има WASM файл; assetsInlineLimit:0 + relative base го запазват коректно.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173
  },
  // sql.js разчита на 'fs'/'path' (Node) когато се bundle-ва; в браузъра ги няма.
  // Празни шимове предотвратяват грешки при build.
  resolve: {
    alias: {
      fs: '/src/shims/empty.js',
      path: '/src/shims/empty.js',
      crypto: '/src/shims/empty.js'
    }
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2020',
    chunkSizeWarningLimit: 2000
  },
  optimizeDeps: {
    exclude: ['sql.js']
  }
});
