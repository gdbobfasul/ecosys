// Version: 1.0020
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HLB_URL, HLB_API_FALLBACK } from './src/config.js';

// Vite конфигурация на HouseLookBook (мобилно издание).
// base:'./' прави всички пътища относителни, което е задължително за Capacitor.
//
// ВГРАЖДАНЕ (07.07.2026): APK-то носи целия сайт public/House-Look-Book (конструкторът рисува
// офлайн). Тук (плъгин embedHouseLookBook) след vite билда:
//   1) копираме public/House-Look-Book/* в dist/ (същото прави и build-mobile-apps.sh — идемпотентно),
//      така че `npm run build` сам дава пълния ап (и smoke-tabs/снимките работят върху dist);
//   2) пишем dist/hlb-config.json от src/config.js — API базата на устройство + резервата
//      (js/hlb-common.js го чете на native; на сайта файлът не съществува и не се търси).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(HERE, '..', '..', 'public', 'House-Look-Book');

function readAppVersion() {
  try { return fs.readFileSync(path.join(HERE, 'app.version'), 'utf8').trim(); } catch (e) { return ''; }
}

function embedHouseLookBook() {
  return {
    name: 'embed-houselookbook',
    apply: 'build',
    closeBundle() {
      const dist = path.join(HERE, 'dist');
      if (!fs.existsSync(dist)) return;
      if (fs.existsSync(SITE_DIR)) {
        fs.cpSync(SITE_DIR, dist, { recursive: true, force: true });
        console.log('  ✓ HouseLookBook вграден в dist (public/House-Look-Book → dist/)');
      } else {
        console.warn('  ⚠ public/House-Look-Book липсва — dist остава само с bootstrap екрана');
      }
      const cfg = {
        _comment: 'Генериран от vite.config.js по src/config.js — НЕ редактирай ръчно. Чете се от js/hlb-common.js само на устройство.',
        apiBase: HLB_URL.replace(/\/+$/, '') + '/api/hlb',
        fallbackApiBase: HLB_API_FALLBACK.replace(/\/+$/, ''),
        version: readAppVersion()
      };
      fs.writeFileSync(path.join(dist, 'hlb-config.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
      console.log('  ✓ dist/hlb-config.json → ' + cfg.apiBase + ' (резерва ' + cfg.fallbackApiBase + ')');
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [embedHouseLookBook()],
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
