import { defineConfig } from 'vite';

// Vite конфигурация — тънка обвивка (shell) за продукционния чат.
// base:'./' прави всички пътища относителни, което е задължително за Capacitor.
//
// ВАЖНО: в продукция Capacitor зарежда чата директно от production URL през
// `server.url` в capacitor.config.json. Този `dist` (index.html + offline екран)
// се ползва САМО като bootstrap/резервен офлайн екран при липса на връзка.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2019',
    assetsInlineLimit: 0
  },
  server: {
    host: true,
    port: 5173
  }
});
