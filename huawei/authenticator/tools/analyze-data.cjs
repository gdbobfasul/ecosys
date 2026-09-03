#!/usr/bin/env node
// analyze-data.cjs — ДЕСКТОП бот „Автоматичен анализатор на данни" за Pupikes Authenticator.
// Обхожда подадена ДИРЕКТОРИЯ, чете всеки .txt (прескача .bak), разпознава РЕД ПО РЕД какво е (парола/
// seed/ключ/адрес/2FA/API/карта/имейл/сайт), пише за ВСЕКИ файл преглед-файл „<име>.analyzed.txt" с ясни
// обозначения (за да ги прегледаш/поправиш), и накрая генерира ЕДИН импорт файл „pupikes-auth-import.json".
//
// Употреба:
//   node huawei/authenticator/tools/analyze-data.cjs [<директория>] [--write-import] [--inplace]
//   • без директория → по подразбиране patch/2026-08-07-p/drugi
//   • --write-import → записва и pupikes-auth-import.json (иначе само преглед-файловете)
//   • --inplace → добавя обозначенията в НАЧАЛОТО на всеки .analyzed.txt (по подразбиране е точно това)
//
// Нищо не се качва навън — само локални файлове. Оригиналите НЕ се пипат (пишем нови .analyzed.txt).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');   // …/2026-06-02-toks
const argDir = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
const DIR = path.resolve(argDir || path.join(ROOT, 'patch/2026-08-07-p/drugi'));
const WRITE_IMPORT = process.argv.includes('--write-import');

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.txt$/i.test(name) && !/\.bak$/i.test(name) && !/\.analyzed\.txt$/i.test(name)) out.push(p);
  }
  return out;
}

// маскира тайна за КОНЗОЛНАТА обобщена таблица (във файловете пишем реалните стойности — те са за теб)
function mask(s) {
  s = String(s || '');
  if (s.length <= 6) return s ? '••••' : '';
  return s.slice(0, 2) + '…' + s.slice(-2);
}

const TYPE_BG = {
  password: 'ПАРОЛА', wallet: 'ПОРТФЕЙЛ (seed/ключ)', address: 'КРИПТО АДРЕС(И)', twofa: '2FA',
  apikey: 'API/ИНФРА', card: 'КАРТА', ssh: 'SSH', qr: 'QR', note: 'БЕЛЕЖКА'
};

function annotateRecord(r, i) {
  const f = r.fields || {};
  const L = [];
  L.push('# ─────────── ЗАПИС #' + (i + 1) + '  ·  ТИП: ' + (TYPE_BG[r.type] || r.type) +
    '  ·  сигурност: ' + Math.round((r.confidence || 0) * 100) + '% ───────────');
  if (r.title) L.push('# заглавие / сайт / портфейл : ' + r.title);
  if (f.url) L.push('# сайт (URL)               : ' + f.url);
  if (f.email) L.push('# имейл                    : ' + f.email);
  if (f.login) L.push('# потребител / логин       : ' + f.login);
  if (f.password) L.push('# парола                   : ' + f.password);
  if (f.seed) L.push('# seed фраза               : ' + f.seed);
  if (f.privkey) L.push('# частен ключ              : ' + f.privkey);
  if (f.apikey) L.push('# API ключ / токен         : ' + f.apikey);
  if (f.card) L.push('# карта                    : ' + f.card);
  if (f.twofa) L.push('# 2FA                      : ' + f.twofa);
  if (f.addresses && f.addresses.length) { L.push('# адреси:'); for (const a of f.addresses) L.push('#    ' + (a.label || '') + ' : ' + a.address); }
  if (f.other) L.push('# друго / втори код        : ' + f.other);
  if (f.note) L.push('# бележка                  : ' + f.note);
  return L.join('\n');
}

function main() {
  if (!fs.existsSync(DIR)) { console.error('Няма директория: ' + DIR); process.exit(1); }
  console.log('🔎 Анализатор на данни — директория: ' + DIR + '\n');

  return import('file://' + path.resolve(ROOT, 'huawei/authenticator/src/core/data-analyzer.js').replace(/\\/g, '/'))
    .then((mod) => {
      const files = walk(DIR);
      const allImport = { passwords: [], seeds: [], entries: [], collection: [], ssh: [], networks: [], tokens: [] };
      const table = [];
      let totalRecords = 0;

      for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        const { records, stats } = mod.analyzeText(text, path.basename(file));
        totalRecords += records.length;
        // преглед-файл
        const rel = path.relative(DIR, file);
        const header = [
          '############################################################',
          '#  PUPIKES AUTHENTICATOR — АВТОМАТИЧЕН АНАЛИЗ (за преглед)  #',
          '#  Файл: ' + rel,
          '#  Разпознати записи: ' + records.length + '  —  прегледай/поправи стойностите долу,',
          '#  после пусни с --write-import за да се генерира импорт файлът.',
          '############################################################',
          ''
        ].join('\n');
        const body = records.map(annotateRecord).join('\n\n');
        const outPath = file.replace(/\.txt$/i, '.analyzed.txt');
        fs.writeFileSync(outPath, header + body + '\n\n\n# ── ОРИГИНАЛ (непроменен, за справка) ──\n' +
          text.split('\n').map((l) => '# ' + l).join('\n') + '\n', 'utf8');
        // импорт
        const imp = mod.recordsToImport(records);
        for (const k of Object.keys(allImport)) allImport[k].push(...(imp[k] || []));
        // конзолна таблица
        for (const r of records) {
          const f = r.fields || {};
          table.push({ file: rel, тип: TYPE_BG[r.type] || r.type, заглавие: r.title || '',
            имейл: f.email || '', парола: mask(f.password), seed: f.seed ? mask(f.seed) : '',
            ключ: mask(f.privkey || f.apikey), адреси: (f.addresses || []).length || '' });
        }
        console.log('  ✓ ' + rel + '  →  ' + records.length + ' записа  →  ' + path.basename(outPath));
      }

      console.log('\n📊 Обобщение: ' + files.length + ' файла, ' + totalRecords + ' разпознати записа.');
      const byType = {};
      for (const t of table) byType[t.тип] = (byType[t.тип] || 0) + 1;
      console.log('   По тип: ' + Object.entries(byType).map(([k, v]) => k + '=' + v).join(', '));
      console.log('   Пароли: ' + allImport.passwords.length + ' · Портфейли/адреси: ' + allImport.seeds.length);

      // маскирана обобщена таблица на конзолата (без реални тайни)
      console.log('\n   Преглед (маскирано — реалните стойности са в .analyzed.txt файловете):');
      for (const t of table.slice(0, 40)) {
        console.log('     • [' + t.тип + '] ' + (t.заглавие || '').slice(0, 22).padEnd(22) +
          (t.имейл ? ' ' + t.имейл : '') + (t.парола ? ' 🔑' + t.парола : '') +
          (t.seed ? ' 🌱' + t.seed : '') + (t.ключ ? ' 🗝' + t.ключ : '') + (t.адреси ? ' 📍' + t.адреси : ''));
      }
      if (table.length > 40) console.log('     … и още ' + (table.length - 40));

      if (WRITE_IMPORT) {
        const impPath = path.join(DIR, 'pupikes-auth-import.json');
        fs.writeFileSync(impPath, JSON.stringify(allImport, null, 1), 'utf8');
        console.log('\n💾 Импорт файл записан: ' + impPath);
        console.log('   → В приложението: Настройки → Импорт → Автоматичен анализатор → избери този файл.');
      } else {
        console.log('\nℹ Пусни пак с --write-import, за да се генерира pupikes-auth-import.json (след преглед).');
      }
    })
    .catch((e) => { console.error('Грешка: ' + (e && e.stack || e)); process.exit(1); });
}

main();
