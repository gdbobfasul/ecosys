// Version: 1.0173
// Записва репорт (JSON + четим Markdown) в reports/<време>/ и връща пътя.
'use strict';
const fs = require('fs');
const path = require('path');

function stamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function renderMd(data) {
  const L = [];
  L.push(`# Робот — репорт (${data.target})`);
  L.push('');
  L.push(`- Цел: \`${data.base}\``);
  L.push(`- Старт: ${data.startedAt}  ·  Времетраене: ${data.durationMs} ms`);
  L.push(`- Сценарии: ${data.scenarios}  ·  Прегледани адреси: ${data.urlsChecked}`);
  L.push(`- **Грешки: ${data.counts.error}  ·  Предупреждения: ${data.counts.warn}  ·  Инфо (очаквани 401/403): ${data.counts.info}**`);
  L.push('');

  const notable = data.findings.filter((f) => f.severity === 'error' || f.severity === 'warn');
  if (!notable.length) {
    L.push('✅ Няма грешки/предупреждения по критичните пътища.');
  } else {
    L.push('## Находки');
    L.push('');
    L.push('| Тежест | Вид | Прил. | HTTP | Къде | Детайл |');
    L.push('|---|---|---|---|---|---|');
    for (const f of notable) {
      const where = f.targetUrl || f.pageUrl || '';
      const det = (f.detail || f.resourceUrl || '').replace(/\|/g, '\\|').slice(0, 140);
      L.push(`| ${f.severity === 'error' ? '🔴' : '🟡'} | ${f.kind} | ${f.app || ''} | ${f.status || ''} | ${where} | ${det} |`);
    }
  }
  const info = data.findings.filter((f) => f.severity === 'info');
  if (info.length) {
    L.push('');
    L.push(`<details><summary>ℹ️ ${info.length} очаквани 401/403 (анонимни проверки — не са бъг)</summary>`);
    L.push('');
    for (const f of info) L.push(`- ${f.status} \`${f.resourceUrl || f.targetUrl}\``);
    L.push('');
    L.push('</details>');
  }
  if (data.forms && data.forms.length) {
    L.push('');
    L.push(`## Открити форми (${data.forms.length}) — за Фаза 3 (fuzz срещу VM)`);
    L.push('');
    L.push('| Страница | Метод | Action | Полета |');
    L.push('|---|---|---|---|');
    for (const f of data.forms.slice(0, 80)) {
      L.push(`| ${(f.page || '').replace(/\|/g, '')} | ${f.method} | ${(f.action || '').replace(/\|/g, '')} | ${(f.fields || []).join(', ').slice(0, 120)} |`);
    }
  }
  if (data.fuzz) {
    L.push('');
    L.push(`## Fuzz (срещу VM) — seed ${data.fuzz.seed}`);
    L.push('');
    L.push(`Повторение на същата последователност: \`node run.js --target vm --fuzz --seed ${data.fuzz.seed}\``);
    L.push('');
    L.push(`Fuzz-нати страници с форми: ${data.fuzz.pages.length}`);
    for (const p of data.fuzz.pages.slice(0, 40)) {
      const submits = p.actions.filter((a) => a.action === 'submit').length;
      L.push(`- \`${p.url}\` — ${p.actions.length} действия, ${submits} изпращания`);
    }
  }
  L.push('');
  L.push('## Сървърен лог (корелация)');
  L.push('');
  if (data.serverLog && data.serverLog.ok) {
    if (data.serverLog.hits.length) {
      L.push('Подозрителни редове от `/last-errors-bundle` (след пускането):');
      L.push('```');
      L.push(...data.serverLog.hits.slice(0, 60));
      L.push('```');
    } else {
      L.push('Сървърният лог не показва грешки (чисто). ✅');
    }
  } else {
    L.push(`⚠️ Не успях да дръпна сървърния лог: ${data.serverLog && data.serverLog.error || 'HTTP ' + (data.serverLog && data.serverLog.status)}`);
  }
  L.push('');
  return L.join('\n');
}

// dir = точната папка на репорта (run.js я създава и слага екранните снимки вътре).
function writeReport(dir, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'report.md'), renderMd(data), 'utf8');
  return dir;
}

module.exports = { writeReport, stamp };
