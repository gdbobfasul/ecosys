// Version: 1.0022
// „Навици и серии" (обогатяване Huawei 4.3, 09.09.2026) — това, което няма в обикновените планери:
//  • всяко напомняне има бутон „Готово за днес" → пази се история по дни (локално);
//  • серия (streak) — колко дни подред е изпълнено; най-дълга серия; % за последните 7 и 30 дни;
//  • седмична решетка (7 дни × навици) с точки; общ „резултат на седмицата";
//  • износ: седмицата като .ics (календар — събития + напомняния) и като текст за споделяне.
// Изцяло на устройството (storage), без мрежа. Самостоятелен модул — не пипа старата логика.
import { h, esc, clear, dayNames } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { getLang } from '../core/i18n.js';

const K_DONE = 'habit_done_v1';   // { [reminderId]: ['YYYY-MM-DD', …] }

const L = {
  title:   { bg:'Навици и серии', ru:'Привычки и серии', uk:'Звички та серії', en:'Habits & streaks', de:'Gewohnheiten & Serien', fr:'Habitudes et séries', es:'Hábitos y rachas', 'es-MX':'Hábitos y rachas', it:'Abitudini e serie', pt:'Hábitos e sequências', ar:'العادات والسلاسل', hi:'आदतें और स्ट्रीक', ja:'習慣と連続記録', ky:'Адаттар жана сериялар', 'zh-Hant':'習慣與連續紀錄' },
  note:    { bg:'Отбележи „Готово" всеки ден — роботът брои сериите и показва седмицата. Всичко е на устройството.', ru:'Отмечайте «Готово» каждый день — робот считает серии и показывает неделю. Всё на устройстве.', uk:'Позначайте «Готово» щодня — робот рахує серії й показує тиждень. Усе на пристрої.', en:'Tap "Done" every day — the robot counts streaks and shows your week. Everything stays on the device.', de:'Tippe täglich auf „Erledigt" — der Roboter zählt Serien und zeigt die Woche. Alles bleibt auf dem Gerät.', fr:'Touchez « Fait » chaque jour — le robot compte les séries et affiche la semaine. Tout reste sur l\'appareil.', es:'Pulsa «Hecho» cada día — el robot cuenta rachas y muestra tu semana. Todo queda en el dispositivo.', 'es-MX':'Pulsa «Hecho» cada día — el robot cuenta rachas y muestra tu semana. Todo queda en el dispositivo.', it:'Tocca «Fatto» ogni giorno — il robot conta le serie e mostra la settimana. Tutto resta sul dispositivo.', pt:'Toque em «Feito» todos os dias — o robô conta sequências e mostra a semana. Tudo fica no dispositivo.', ar:'اضغط «تم» كل يوم — يحسب الروبوت السلاسل ويعرض أسبوعك. كل شيء يبقى على الجهاز.', hi:'हर दिन "हो गया" दबाएँ — रोबोट स्ट्रीक गिनता है और सप्ताह दिखाता है। सब कुछ डिवाइस पर रहता है।', ja:'毎日「完了」をタップ — ロボットが連続記録を数え、週を表示します。すべて端末内。', ky:'Күн сайын «Даяр» бас — робот серияларды эсептеп, жуманы көрсөтөт. Баары түзмөктө.', 'zh-Hant':'每天點「完成」— 機器人統計連續紀錄並顯示本週。全部保存在裝置上。' },
  done:    { bg:'Готово за днес', ru:'Готово на сегодня', uk:'Готово на сьогодні', en:'Done for today', de:'Heute erledigt', fr:'Fait pour aujourd\'hui', es:'Hecho por hoy', 'es-MX':'Hecho por hoy', it:'Fatto per oggi', pt:'Feito por hoje', ar:'تم لليوم', hi:'आज के लिए हो गया', ja:'今日は完了', ky:'Бүгүнкү даяр', 'zh-Hant':'今天完成' },
  undo:    { bg:'Отмени', ru:'Отменить', uk:'Скасувати', en:'Undo', de:'Rückgängig', fr:'Annuler', es:'Deshacer', 'es-MX':'Deshacer', it:'Annulla', pt:'Anular', ar:'تراجع', hi:'पूर्ववत', ja:'取り消し', ky:'Артка', 'zh-Hant':'復原' },
  streak:  { bg:'серия', ru:'серия', uk:'серія', en:'streak', de:'Serie', fr:'série', es:'racha', 'es-MX':'racha', it:'serie', pt:'sequência', ar:'سلسلة', hi:'स्ट्रीक', ja:'連続', ky:'серия', 'zh-Hant':'連續' },
  best:    { bg:'най-дълга', ru:'лучшая', uk:'найдовша', en:'best', de:'beste', fr:'record', es:'mejor', 'es-MX':'mejor', it:'migliore', pt:'melhor', ar:'الأفضل', hi:'सर्वश्रेष्ठ', ja:'最長', ky:'эң узун', 'zh-Hant':'最佳' },
  days:    { bg:'дни', ru:'дн.', uk:'дн.', en:'days', de:'Tage', fr:'jours', es:'días', 'es-MX':'días', it:'giorni', pt:'dias', ar:'أيام', hi:'दिन', ja:'日', ky:'күн', 'zh-Hant':'天' },
  week:    { bg:'Тази седмица', ru:'Эта неделя', uk:'Цей тиждень', en:'This week', de:'Diese Woche', fr:'Cette semaine', es:'Esta semana', 'es-MX':'Esta semana', it:'Questa settimana', pt:'Esta semana', ar:'هذا الأسبوع', hi:'इस सप्ताह', ja:'今週', ky:'Бул жума', 'zh-Hant':'本週' },
  score:   { bg:'Резултат на седмицата', ru:'Итог недели', uk:'Підсумок тижня', en:'Week score', de:'Wochenergebnis', fr:'Score de la semaine', es:'Puntuación semanal', 'es-MX':'Puntuación semanal', it:'Punteggio settimanale', pt:'Pontuação da semana', ar:'نتيجة الأسبوع', hi:'सप्ताह का स्कोर', ja:'週間スコア', ky:'Жуманын жыйынтыгы', 'zh-Hant':'本週分數' },
  d7:      { bg:'7 дни', ru:'7 дней', uk:'7 днів', en:'7 days', de:'7 Tage', fr:'7 jours', es:'7 días', 'es-MX':'7 días', it:'7 giorni', pt:'7 dias', ar:'7 أيام', hi:'7 दिन', ja:'7日間', ky:'7 күн', 'zh-Hant':'7 天' },
  d30:     { bg:'30 дни', ru:'30 дней', uk:'30 днів', en:'30 days', de:'30 Tage', fr:'30 jours', es:'30 días', 'es-MX':'30 días', it:'30 giorni', pt:'30 dias', ar:'30 يوماً', hi:'30 दिन', ja:'30日間', ky:'30 күн', 'zh-Hant':'30 天' },
  empty:   { bg:'Добави напомняния (навици) по-горе — тук ще виждаш сериите им.', ru:'Добавьте напоминания (привычки) выше — здесь будут их серии.', uk:'Додайте нагадування (звички) вище — тут будуть їхні серії.', en:'Add reminders (habits) above — their streaks will show here.', de:'Füge oben Erinnerungen (Gewohnheiten) hinzu — ihre Serien erscheinen hier.', fr:'Ajoutez des rappels (habitudes) ci-dessus — leurs séries s\'afficheront ici.', es:'Añade recordatorios (hábitos) arriba — aquí verás sus rachas.', 'es-MX':'Agrega recordatorios (hábitos) arriba — aquí verás sus rachas.', it:'Aggiungi promemoria (abitudini) sopra — qui vedrai le loro serie.', pt:'Adicione lembretes (hábitos) acima — as sequências aparecem aqui.', ar:'أضف تذكيرات (عادات) أعلاه — ستظهر سلاسلها هنا.', hi:'ऊपर रिमाइंडर (आदतें) जोड़ें — उनकी स्ट्रीक यहाँ दिखेगी।', ja:'上でリマインダー（習慣）を追加 — 連続記録がここに表示されます。', ky:'Жогоруда эскертүүлөрдү (адаттарды) кош — сериялары бул жерде көрүнөт.', 'zh-Hant':'在上方新增提醒（習慣）— 連續紀錄會顯示於此。' },
  export:  { bg:'Износ на седмицата', ru:'Экспорт недели', uk:'Експорт тижня', en:'Export the week', de:'Woche exportieren', fr:'Exporter la semaine', es:'Exportar la semana', 'es-MX':'Exportar la semana', it:'Esporta la settimana', pt:'Exportar a semana', ar:'تصدير الأسبوع', hi:'सप्ताह निर्यात', ja:'週をエクスポート', ky:'Жуманы экспорттоо', 'zh-Hant':'匯出本週' },
  ics:     { bg:'Календар (.ics)', ru:'Календарь (.ics)', uk:'Календар (.ics)', en:'Calendar (.ics)', de:'Kalender (.ics)', fr:'Calendrier (.ics)', es:'Calendario (.ics)', 'es-MX':'Calendario (.ics)', it:'Calendario (.ics)', pt:'Calendário (.ics)', ar:'التقويم (.ics)', hi:'कैलेंडर (.ics)', ja:'カレンダー（.ics）', ky:'Календарь (.ics)', 'zh-Hant':'行事曆（.ics）' },
  share:   { bg:'Сподели като текст', ru:'Поделиться текстом', uk:'Поділитися текстом', en:'Share as text', de:'Als Text teilen', fr:'Partager en texte', es:'Compartir como texto', 'es-MX':'Compartir como texto', it:'Condividi come testo', pt:'Partilhar como texto', ar:'مشاركة كنص', hi:'टेक्स्ट के रूप में साझा करें', ja:'テキストで共有', ky:'Текст катары бөлүшүү', 'zh-Hant':'以文字分享' },
  copied:  { bg:'Копирано', ru:'Скопировано', uk:'Скопійовано', en:'Copied', de:'Kopiert', fr:'Copié', es:'Copiado', 'es-MX':'Copiado', it:'Copiato', pt:'Copiado', ar:'تم النسخ', hi:'कॉपी हो गया', ja:'コピーしました', ky:'Көчүрүлдү', 'zh-Hant':'已複製' },
  events:  { bg:'Събития', ru:'События', uk:'Події', en:'Events', de:'Termine', fr:'Événements', es:'Eventos', 'es-MX':'Eventos', it:'Eventi', pt:'Eventos', ar:'الأحداث', hi:'इवेंट', ja:'予定', ky:'Иш-чаралар', 'zh-Hant':'活動' }
};
const tr = (k) => { const e = L[k]; return e ? (e[getLang()] || e.en) : k; };

const dstr = (d) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// Дни, в които навикът е „планиран" (repeatDays; празно = всеки ден).
const planned = (r, d) => { const days = r.repeatDays && r.repeatDays.length ? r.repeatDays : [0, 1, 2, 3, 4, 5, 6]; return days.indexOf(new Date(d).getDay()) >= 0; };
export function streakOf(r, doneSet, today) {
  let cur = 0, best = 0, run = 0;
  for (let i = 0; i < 365; i++) {
    const d = addDays(today, -i); if (!planned(r, d)) continue;
    const ok = doneSet.has(dstr(d));
    if (i === 0 && !ok) continue;       // днес още може да се направи — не чупи серията
    if (ok) { run++; if (i === 0 || cur === run - 1) cur = run; } else { break; }
  }
  // най-дълга серия за 365 дни
  run = 0;
  for (let i = 364; i >= 0; i--) { const d = addDays(today, -i); if (!planned(r, d)) continue; if (doneSet.has(dstr(d))) { run++; best = Math.max(best, run); } else run = 0; }
  return { cur, best: Math.max(best, cur) };
}
const pct = (r, doneSet, today, n) => { let p = 0, ok = 0; for (let i = 0; i < n; i++) { const d = addDays(today, -i); if (!planned(r, d)) continue; p++; if (doneSet.has(dstr(d))) ok++; } return p ? Math.round(100 * ok / p) : 0; };

function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function buildIcs(reminders, events, today) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pupikes//Routine Planner//EN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i); const ds = dstr(d).replace(/-/g, '');
    reminders.filter((r) => !r.paused && planned(r, d)).forEach((r) => {
      const hh = (r.time || '09:00').replace(':', '');
      lines.push('BEGIN:VEVENT', 'UID:' + r.id + '-' + ds + '@pupikes', 'DTSTAMP:' + stamp, 'DTSTART:' + ds + 'T' + hh + '00', 'DURATION:PT15M', 'SUMMARY:' + icsEscape(r.title), r.note ? 'DESCRIPTION:' + icsEscape(r.note) : null, 'END:VEVENT');
    });
    (events || []).filter((e) => (e.date || '').slice(0, 10) === dstr(d)).forEach((e, k) => {
      const hh = (e.time || '09:00').replace(':', '');
      lines.push('BEGIN:VEVENT', 'UID:ev-' + ds + '-' + k + '@pupikes', 'DTSTAMP:' + stamp, 'DTSTART:' + ds + 'T' + hh + '00', 'DURATION:PT1H', 'SUMMARY:' + icsEscape(e.title || e.text || 'Event'), 'END:VEVENT');
    });
  }
  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}
function buildText(reminders, events, today, DAYS) {
  const out = [tr('week') + ' — ' + dstr(today)];
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const items = reminders.filter((r) => !r.paused && planned(r, d)).map((r) => r.time + ' ' + r.title)
      .concat((events || []).filter((e) => (e.date || '').slice(0, 10) === dstr(d)).map((e) => (e.time || '') + ' ' + (e.title || e.text || '')));
    out.push(DAYS[d.getDay()] + ' ' + dstr(d).slice(5) + ': ' + (items.length ? items.join(' · ') : '—'));
  }
  return out.join('\n');
}
async function shareText(text) {
  try { if (navigator.share) { await navigator.share({ text }); return true; } } catch (_) {}
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  return false;
}
function download(name, text, mime) {
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (_) {}
  shareText(text);   // на устройство без изтегляне → споделяне/клипборд
}

export async function mountHabits(container) {
  clear(container);
  const reminders = await storage.get(KEYS.reminders, []);
  const events = await storage.get(KEYS.events, []);
  const done = await storage.get(K_DONE, {});
  const today = new Date(); const todayS = dstr(today);
  const DAYS = dayNames();
  const wrap = h(`<div class="card"><h2>${esc(tr('title'))}</h2><p class="muted">${esc(tr('note'))}</p><div id="hb-list"></div><div id="hb-week"></div><div class="spacer"></div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn secondary small" id="hb-ics">📅 ${esc(tr('ics'))}</button><button class="btn secondary small" id="hb-share">📤 ${esc(tr('share'))}</button></div></div>`);
  const list = wrap.querySelector('#hb-list'), week = wrap.querySelector('#hb-week');
  const active = reminders.filter((r) => !r.paused);
  if (!active.length) list.appendChild(h(`<p class="muted">${esc(tr('empty'))}</p>`));
  let total = 0, okTotal = 0;
  active.forEach((r) => {
    const set = new Set(done[r.id] || []);
    const st = streakOf(r, set, today);
    const isDone = set.has(todayS);
    const row = h(`<div class="list-item"><div class="row"><div><strong>${esc(r.title)}</strong> <span class="pill">${esc(r.time || '')}</span>
      <div class="muted">🔥 ${st.cur} ${esc(tr('days'))} ${esc(tr('streak'))} · ${esc(tr('best'))} ${st.best} · ${esc(tr('d7'))} ${pct(r, set, today, 7)}% · ${esc(tr('d30'))} ${pct(r, set, today, 30)}%</div></div>
      <button class="btn ${isDone ? 'secondary' : ''} small" data-done>${isDone ? '↶ ' + esc(tr('undo')) : '✅ ' + esc(tr('done'))}</button></div></div>`);
    row.querySelector('[data-done]').addEventListener('click', async () => {
      const cur = await storage.get(K_DONE, {}); const arr = new Set(cur[r.id] || []);
      if (arr.has(todayS)) arr.delete(todayS); else arr.add(todayS);
      cur[r.id] = [...arr].sort().slice(-400); await storage.set(K_DONE, cur); await mountHabits(container);
    });
    list.appendChild(row);
    for (let i = 6; i >= 0; i--) { const d = addDays(today, -i); if (!planned(r, d)) continue; total++; if (set.has(dstr(d))) okTotal++; }
  });
  if (active.length) {
    // седмична решетка: 7 дни назад × навици (● готово / ○ пропуснато / · неплануван)
    const head = [];
    for (let i = 6; i >= 0; i--) head.push(DAYS[addDays(today, -i).getDay()]);
    let html = `<div class="muted" style="margin-top:8px"><b>${esc(tr('week'))}</b> · ${esc(tr('score'))}: <b>${total ? Math.round(100 * okTotal / total) : 0}%</b></div>`;
    html += '<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:13px;margin-top:4px"><tr><td></td>' + head.map((x) => '<td style="padding:2px 6px;text-align:center" class="muted">' + esc(x) + '</td>').join('') + '</tr>';
    active.forEach((r) => { const set = new Set(done[r.id] || []); html += '<tr><td style="padding:2px 6px;white-space:nowrap">' + esc(r.title.slice(0, 18)) + '</td>'; for (let i = 6; i >= 0; i--) { const d = addDays(today, -i); const c = !planned(r, d) ? '<span class="muted">·</span>' : (set.has(dstr(d)) ? '<span style="color:#16c784">●</span>' : '<span style="color:#ea3943">○</span>'); html += '<td style="text-align:center;padding:2px 6px">' + c + '</td>'; } html += '</tr>'; });
    html += '</table></div>';
    week.innerHTML = html;
  }
  wrap.querySelector('#hb-ics').addEventListener('click', () => download('routine-week.ics', buildIcs(reminders, events, today), 'text/calendar'));
  wrap.querySelector('#hb-share').addEventListener('click', async (e) => { if (await shareText(buildText(reminders, events, today, DAYS))) e.target.textContent = '✓ ' + tr('copied'); });
  container.appendChild(wrap);
}
