import { defineConfig } from 'vite';

// Конфигурация на Vite за десктоп клонинга.
// root: 'renderer' -> index.html + src/ живеят там (копие на уеб апа).
// base: './' -> относителни пътища (зареждаме построения dist през локален файл-сървър).
// outDir: '../dist' -> построеният renderer отива в desktop/selflearning-friend/dist,
//   откъдето Electron го сервира.
export default defineConfig({
  root: 'renderer',
  base: './',
  server: {
    host: true,
    port: 5194
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    target: 'es2019'
  }
});
