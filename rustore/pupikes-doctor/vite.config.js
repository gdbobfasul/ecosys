// Version: 1.0022
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Vite конфигурация — офлайн-първо приложение.
// base:'./' прави всички пътища относителни, което е задължително за Capacitor
// (приложението се сервира от file:// или от вградения http сървър без коренов път).

// ── Разделяне на снимковия корпус (Huawei 3.1, 11.09.2026) ─────────────────────────────
// Източникът е public/reference/image-signatures.json (~6 MB JSON, base64 по 256 B на снимка).
// В апа той се парсваше НАВЕДНЪЖ при първия анализ → дълго чакане/памет на слаби телефони.
// При билд го разделяме на ДВОИЧНИ части (dist/reference/sig/part-N.bin + manifest.json):
//   част 0 = етикетите, които съответстват на състоянията в апа (първа помощ) — малка и се зарежда първа;
//   части 1..3 = дерматологичният остатък. Апът ги тегли лениво след първия екран и работи и с част от тях.
// JSON-ът НЕ пътува в APK-то (само частите). Стендът private/medikit-harvester чете JSON-а както преди.
function condRelevant(lab) {
  return /sunburn|burn|scald|bruis|contusion|h(a)?ematoma|ecchymos|abrasion|graze|wound|laceration|\bcut\b|incision|urticaria|hives|psorias|dermatitis|eczema|tinea|dermatophyt|fungal|candid|mycos|furuncle|boil|abscess|carbuncle|cellulitis|impetigo|infect|pyoderma|blister|bulla|vesic|frostbite|chilblain|pernio|fracture|sprain|dislocation|bite|sting|edema|oedema|swelling|ingrown|rash|exanthem|erythema/.test(String(lab || '').toLowerCase());
}
function splitSignatures() {
  return {
    name: 'pupikes-split-signatures',
    apply: 'build',
    closeBundle() {
      const src = path.resolve('public/reference/image-signatures.json');
      const outDir = path.resolve('dist/reference/sig');
      if (!fs.existsSync(src)) { console.log('  ! няма public/reference/image-signatures.json — корпусът не е разделен'); return; }
      const j = JSON.parse(fs.readFileSync(src, 'utf8'));
      const dim = j.dim || 256, items = j.items || [], labels = j.labels || [];
      const first = [], rest = [];
      for (const it of items) (condRelevant(labels[it.l]) ? first : rest).push(it);
      const PARTS = 3, per = Math.max(1, Math.ceil(rest.length / PARTS));
      const groups = [first]; for (let i = 0; i < rest.length; i += per) groups.push(rest.slice(i, i + per));
      fs.mkdirSync(outDir, { recursive: true });
      const parts = [];
      groups.forEach((g, gi) => {
        const n = g.length, buf = Buffer.alloc(n * 2 + n * dim);
        for (let i = 0; i < n; i++) {
          buf.writeUInt16LE(g[i].l & 0xffff, i * 2);
          Buffer.from(g[i].v, 'base64').copy(buf, n * 2 + i * dim, 0, dim);
        }
        const file = 'part-' + gi + '.bin';
        fs.writeFileSync(path.join(outDir, file), buf);
        parts.push({ file, n, firstAid: gi === 0, bytes: buf.length });
      });
      fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ dim, n: items.length, labels, parts }));
      try { fs.unlinkSync(path.resolve('dist/reference/image-signatures.json')); } catch (_) {}
      console.log('  ✓ корпус разделен: ' + items.length + ' отпечатъка → ' + parts.length + ' части (част 0 = ' + first.length + ' първа помощ)');
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [splitSignatures()],
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
