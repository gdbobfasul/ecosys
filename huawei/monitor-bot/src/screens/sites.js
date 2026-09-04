// Version: 1.0025
// Обогатяване (Huawei 4.1): екран „Сайтове" със 4 таба (топ-навигация).
//  1) Търсене СЕГА (текуща проверка, без аларма — както Google)   [reuse: жив скрейп + текст]
//  2) Ежедневно: поява на ТЕКСТ в сайт → аларма
//  3) Ежедневно: поява на КАРТИНКА (идентична по размер+байтове) → аларма
//  4) Ежедневно: смяна на СТАТУС online/offline → аларма
// Самостоятелно (localStorage + собствен дневен планировчик), не пипа старите монитори.
import { getLang } from '../core/i18n.js';
import { notify, requestNotifPermission } from '../core/notifier.js';
import * as SW from '../core/site-watch.js';

const LSK = 'monitor-bot.siteWatch.v1';
const LSK_MUSIC = 'monitor-bot.alarmMusic.v1';

// ── 15-езичен локален речник ──
const L = {
  tab_now:   { bg:'Търси сега', ru:'Искать сейчас', uk:'Шукати зараз', en:'Search now', de:'Jetzt suchen', fr:'Chercher', es:'Buscar ahora', 'es-MX':'Buscar ahora', it:'Cerca ora', pt:'Buscar agora', ar:'ابحث الآن', hi:'अभी खोजें', ja:'今すぐ検索', ky:'Азыр изде', 'zh-Hant':'立即搜尋' },
  tab_text:  { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'نص', hi:'टेक्स्ट', ja:'テキスト', ky:'Текст', 'zh-Hant':'文字' },
  tab_img:   { bg:'Картинка', ru:'Картинка', uk:'Зображення', en:'Image', de:'Bild', fr:'Image', es:'Imagen', 'es-MX':'Imagen', it:'Immagine', pt:'Imagem', ar:'صورة', hi:'छवि', ja:'画像', ky:'Сүрөт', 'zh-Hant':'圖片' },
  tab_up:    { bg:'Статус', ru:'Статус', uk:'Статус', en:'Status', de:'Status', fr:'Statut', es:'Estado', 'es-MX':'Estado', it:'Stato', pt:'Estado', ar:'الحالة', hi:'स्थिति', ja:'状態', ky:'Абал', 'zh-Hant':'狀態' },
  url:       { bg:'Адрес на сайта', ru:'Адрес сайта', uk:'Адреса сайту', en:'Site URL', de:'Website-URL', fr:'URL du site', es:'URL del sitio', 'es-MX':'URL del sitio', it:'URL del sito', pt:'URL do site', ar:'رابط الموقع', hi:'साइट URL', ja:'サイトURL', ky:'Сайт дареги', 'zh-Hant':'網站網址' },
  phrase:    { bg:'Текст за търсене', ru:'Текст для поиска', uk:'Текст для пошуку', en:'Text to find', de:'Suchtext', fr:'Texte à trouver', es:'Texto a buscar', 'es-MX':'Texto a buscar', it:'Testo da trovare', pt:'Texto a procurar', ar:'النص المطلوب', hi:'खोजने का टेक्स्ट', ja:'検索テキスト', ky:'Изделүүчү текст', 'zh-Hant':'搜尋文字' },
  pick_img:  { bg:'Избери картинка (еталон)', ru:'Выбрать картинку (эталон)', uk:'Обрати зображення', en:'Pick reference image', de:'Referenzbild wählen', fr:'Choisir l’image', es:'Elegir imagen', 'es-MX':'Elegir imagen', it:'Scegli immagine', pt:'Escolher imagem', ar:'اختر صورة مرجعية', hi:'संदर्भ छवि चुनें', ja:'基準画像を選択', ky:'Эталон сүрөт танда', 'zh-Hant':'選擇參考圖片' },
  add:       { bg:'Добави за ежедневно следене', ru:'Добавить (ежедневно)', uk:'Додати (щоденно)', en:'Add daily watch', de:'Täglich überwachen', fr:'Suivi quotidien', es:'Añadir seguimiento diario', 'es-MX':'Añadir seguimiento diario', it:'Aggiungi controllo giornaliero', pt:'Adicionar diário', ar:'إضافة مراقبة يومية', hi:'दैनिक निगरानी जोड़ें', ja:'毎日監視に追加', ky:'Күндөлүк кошуу', 'zh-Hant':'加入每日監看' },
  check_now: { bg:'Провери сега', ru:'Проверить сейчас', uk:'Перевірити зараз', en:'Check now', de:'Jetzt prüfen', fr:'Vérifier', es:'Verificar ahora', 'es-MX':'Verificar ahora', it:'Verifica ora', pt:'Verificar agora', ar:'تحقق الآن', hi:'अभी जांचें', ja:'今すぐ確認', ky:'Азыр текшер', 'zh-Hant':'立即檢查' },
  search:    { bg:'Търси', ru:'Искать', uk:'Шукати', en:'Search', de:'Suchen', fr:'Chercher', es:'Buscar', 'es-MX':'Buscar', it:'Cerca', pt:'Buscar', ar:'ابحث', hi:'खोजें', ja:'検索', ky:'Изде', 'zh-Hant':'搜尋' },
  del:       { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Excluir', ar:'حذف', hi:'हटाएं', ja:'削除', ky:'Өчүр', 'zh-Hant':'刪除' },
  found:     { bg:'НАМЕРЕНО ✅', ru:'НАЙДЕНО ✅', uk:'ЗНАЙДЕНО ✅', en:'FOUND ✅', de:'GEFUNDEN ✅', fr:'TROUVÉ ✅', es:'ENCONTRADO ✅', 'es-MX':'ENCONTRADO ✅', it:'TROVATO ✅', pt:'ENCONTRADO ✅', ar:'تم العثور ✅', hi:'मिल गया ✅', ja:'発見 ✅', ky:'ТАБЫЛДЫ ✅', 'zh-Hant':'找到 ✅' },
  notfound:  { bg:'Не е намерено', ru:'Не найдено', uk:'Не знайдено', en:'Not found', de:'Nicht gefunden', fr:'Introuvable', es:'No encontrado', 'es-MX':'No encontrado', it:'Non trovato', pt:'Não encontrado', ar:'غير موجود', hi:'नहीं मिला', ja:'見つかりません', ky:'Табылган жок', 'zh-Hant':'找不到' },
  online:    { bg:'Онлайн', ru:'Онлайн', uk:'Онлайн', en:'Online', de:'Online', fr:'En ligne', es:'En línea', 'es-MX':'En línea', it:'Online', pt:'Online', ar:'متصل', hi:'ऑनलाइन', ja:'オンライン', ky:'Онлайн', 'zh-Hant':'線上' },
  offline:   { bg:'Офлайн', ru:'Офлайн', uk:'Офлайн', en:'Offline', de:'Offline', fr:'Hors ligne', es:'Sin conexión', 'es-MX':'Sin conexión', it:'Offline', pt:'Offline', ar:'غير متصل', hi:'ऑफलाइन', ja:'オフライン', ky:'Оффлайн', 'zh-Hant':'離線' },
  music:     { bg:'Музика за аларма', ru:'Музыка тревоги', uk:'Музика тривоги', en:'Alarm music', de:'Alarm-Musik', fr:'Musique d’alarme', es:'Música de alarma', 'es-MX':'Música de alarma', it:'Musica allarme', pt:'Música de alarme', ar:'موسيقى التنبيه', hi:'अलार्म संगीत', ja:'アラーム音', ky:'Дабыл музыкасы', 'zh-Hant':'警報音樂' },
  pick_music:{ bg:'Избери музика', ru:'Выбрать музыку', uk:'Обрати музику', en:'Pick music', de:'Musik wählen', fr:'Choisir musique', es:'Elegir música', 'es-MX':'Elegir música', it:'Scegli musica', pt:'Escolher música', ar:'اختر الموسيقى', hi:'संगीत चुनें', ja:'音楽を選択', ky:'Музыка танда', 'zh-Hant':'選擇音樂' },
  test:      { bg:'Пробвай', ru:'Тест', uk:'Тест', en:'Test', de:'Test', fr:'Test', es:'Probar', 'es-MX':'Probar', it:'Prova', pt:'Testar', ar:'اختبار', hi:'टेस्ट', ja:'テスト', ky:'Сына', 'zh-Hant':'測試' },
  daily_note:{ bg:'Проверява се веднъж дневно; при сработване получаваш известие и музиката.', ru:'Проверка раз в день; при срабатывании — уведомление и музыка.', uk:'Перевірка раз на день; сповіщення і музика при спрацюванні.', en:'Checked once daily; you get a notification and the music when it triggers.', de:'Einmal täglich geprüft; bei Auslösung Benachrichtigung und Musik.', fr:'Vérifié une fois par jour ; notification et musique au déclenchement.', es:'Se revisa una vez al día; notificación y música al activarse.', 'es-MX':'Se revisa una vez al día; notificación y música al activarse.', it:'Controllato una volta al giorno; notifica e musica all’attivazione.', pt:'Verificado uma vez por dia; notificação e música ao disparar.', ar:'يتم الفحص مرة يوميًا؛ إشعار وموسيقى عند التفعيل.', hi:'दिन में एक बार जांच; ट्रिगर होने पर सूचना और संगीत।', ja:'1日1回チェック。作動時に通知と音楽。', ky:'Күнүнө бир жолу текшерилет; иштегенде билдирүү жана музыка.', 'zh-Hant':'每日檢查一次；觸發時發出通知並播放音樂。' },
  now_note:  { bg:'Търси в момента (без аларма) — както в Google: покажи резултат, ако е намерен.', ru:'Поиск сейчас (без тревоги).', uk:'Пошук зараз (без тривоги).', en:'Live search (no alarm) — like Google: shows a result if found now.', de:'Live-Suche (kein Alarm).', fr:'Recherche en direct (sans alarme).', es:'Búsqueda en vivo (sin alarma).', 'es-MX':'Búsqueda en vivo (sin alarma).', it:'Ricerca live (senza allarme).', pt:'Busca ao vivo (sem alarme).', ar:'بحث مباشر (بدون تنبيه).', hi:'लाइव खोज (कोई अलार्म नहीं)।', ja:'ライブ検索（アラームなし）。', ky:'Түз издөө (дабылсыз).', 'zh-Hant':'即時搜尋（無警報）。' }
};
function tr(k) { const e = L[k]; return e ? (e[getLang()] || e.en) : k; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── Хранилище на watcher-ите ──
function load() { try { return JSON.parse(localStorage.getItem(LSK) || '[]'); } catch (e) { return []; } }
function save(list) { try { localStorage.setItem(LSK, JSON.stringify(list)); } catch (e) {} }
function loadMusic() { try { return localStorage.getItem(LSK_MUSIC) || ''; } catch (e) { return ''; } }
function saveMusic(dataUrl) { try { localStorage.setItem(LSK_MUSIC, dataUrl || ''); } catch (e) {} }

function playAlarmMusic() { const m = loadMusic(); if (!m) return; try { const a = new Audio(m); a.play().catch(() => {}); } catch (e) {} }

// Избор на файл → data URL (за музика/еталонна картинка).
function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input'); inp.type = 'file'; if (accept) inp.accept = accept;
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return resolve(null); const r = new FileReader(); r.onload = () => resolve({ name: f.name, size: f.size, dataUrl: r.result }); r.onerror = () => resolve(null); r.readAsDataURL(f); };
    inp.click();
  });
}
function dataUrlToBytes(dataUrl) { try { const b64 = String(dataUrl).replace(/^data:[^,]*,/, ''); const bin = atob(b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; } catch (e) { return null; } }

// ── ЕЖЕДНЕВЕН ПЛАНИРОВЧИК (самостоятелен; проверява дали е минал 1 ден) ──
let timer = null;
export function startSiteWatch() {
  if (timer) return; requestNotifPermission().catch(() => {});
  const run = () => runDueChecks().catch(() => {});
  run();                               // при старт
  timer = setInterval(run, 60 * 60 * 1000); // всеки час проверяваме дали е дошъл денят
}
async function runDueChecks() {
  const list = load(); const now = Date.now(); let changed = false;
  for (const w of list) {
    if (w.tab === 'now') continue;
    if (w.lastCheck && now - w.lastCheck < 24 * 60 * 60 * 1000) continue; // веднъж дневно
    const res = await checkWatcher(w);
    w.lastCheck = now; w.lastResult = res.summary; changed = true;
    if (res.trigger) { w.triggered = true; notify(res.title, res.body).catch(() => {}); playAlarmMusic(); }
  }
  if (changed) save(list);
}

// Изпълнява една проверка според типа.
async function checkWatcher(w) {
  if (w.tab === 'text') {
    const r = await SW.checkTextOnSite(w.url, w.phrase);
    const found = r.ok && r.found;
    return { trigger: found && !w.triggered, summary: found ? tr('found') : tr('notfound'), title: tr('tab_text') + ' ✅', body: w.phrase + ' — ' + w.url };
  }
  if (w.tab === 'img') {
    const ref = w.refDataUrl ? dataUrlToBytes(w.refDataUrl) : null;
    const r = await SW.checkImageOnSite(w.url, ref);
    const found = r.ok && r.found;
    return { trigger: found && !w.triggered, summary: found ? tr('found') : tr('notfound'), title: tr('tab_img') + ' ✅', body: w.url };
  }
  if (w.tab === 'up') {
    const r = await SW.checkUptime(w.url);
    const online = !!r.online;
    const prev = w.lastOnline;
    w.lastOnline = online;
    const changed = (prev != null && prev !== online);
    return { trigger: changed, summary: online ? tr('online') : tr('offline'), title: tr('tab_up') + ' ⚠', body: w.url + ' → ' + (online ? tr('online') : tr('offline')) };
  }
  return { trigger: false, summary: '' };
}

const TABS = ['now', 'text', 'img', 'up'];
const TAB_LABEL = { now: 'tab_now', text: 'tab_text', img: 'tab_img', up: 'tab_up' };
let active = 'now';

let styled = false;
function injectSiteStyles() {
  if (styled) return; styled = true;
  const css = `
  .mkt-tabs{display:flex;overflow-x:auto;gap:6px;padding:8px 4px;position:sticky;top:0;z-index:5;-webkit-overflow-scrolling:touch}
  .mkt-tab{flex:0 0 auto;padding:8px 14px;border-radius:999px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;font-size:14px;cursor:pointer;white-space:nowrap}
  .mkt-tab.active{background:#2b6cff;border-color:#2b6cff;color:#fff;font-weight:600}
  .mkt-body{padding:10px}
  .sites-wrap .inp{display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:11px 12px;border-radius:10px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font-size:15px}
  .sites-wrap .hit{color:#16c784}
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

// Рендер — връща DOM елемент (както другите екрани в този ап).
export function renderSites(ctx) {
  injectSiteStyles();
  const wrap = document.createElement('div');
  wrap.className = 'sites-wrap';
  draw();
  function draw() {
    wrap.innerHTML =
      '<div class="mkt-tabs">' + TABS.map((k) => '<button class="mkt-tab' + (k === active ? ' active' : '') + '" data-tab="' + k + '">' + esc(tr(TAB_LABEL[k])) + '</button>').join('') + '</div>' +
      '<div class="mkt-body" id="sites-body"></div>';
    wrap.querySelectorAll('.mkt-tab').forEach((b) => b.addEventListener('click', () => { active = b.getAttribute('data-tab'); draw(); }));
    const body = wrap.querySelector('#sites-body');
    if (active === 'now') return drawNow(body);
    return drawDaily(body, active);
  }

  // ── ТАБ 1: търсене СЕГА (без аларма) ──
  function drawNow(body) {
    body.innerHTML =
      '<p class="muted">' + esc(tr('now_note')) + '</p>' +
      '<input class="inp" id="n-url" placeholder="' + esc(tr('url')) + '" />' +
      '<input class="inp" id="n-ph" placeholder="' + esc(tr('phrase')) + '" />' +
      '<button class="btn" id="n-go">' + esc(tr('search')) + '</button>' +
      '<div id="n-res" style="margin-top:12px"></div>';
    body.querySelector('#n-go').addEventListener('click', async () => {
      const url = body.querySelector('#n-url').value.trim(); const ph = body.querySelector('#n-ph').value.trim();
      const res = body.querySelector('#n-res'); if (!url || !ph) return; res.innerHTML = '…';
      const r = await SW.checkTextOnSite(url, ph).catch(() => ({ ok: false }));
      res.innerHTML = !r.ok ? '<span class="muted">—</span>' : (r.found ? '<b class="hit">' + esc(tr('found')) + '</b>' : '<span class="muted">' + esc(tr('notfound')) + '</span>');
    });
  }

  // ── ТАБОВЕ 2/3/4: ежедневни watcher-и ──
  function drawDaily(body, tab) {
    const list = load().filter((w) => w.tab === tab);
    let form = '<p class="muted">' + esc(tr('daily_note')) + '</p><input class="inp" id="d-url" placeholder="' + esc(tr('url')) + '" />';
    if (tab === 'text') form += '<input class="inp" id="d-ph" placeholder="' + esc(tr('phrase')) + '" />';
    if (tab === 'img') form += '<button class="btn ghost" id="d-pick">' + esc(tr('pick_img')) + '</button> <span id="d-imgname" class="muted"></span>';
    form += '<button class="btn" id="d-add">' + esc(tr('add')) + '</button>';
    // музика
    form += '<div style="margin-top:14px"><b>' + esc(tr('music')) + '</b><br><button class="btn ghost sm" id="d-music">' + esc(tr('pick_music')) + '</button> <button class="btn ghost sm" id="d-mtest">' + esc(tr('test')) + '</button> <span id="d-mname" class="muted">' + (loadMusic() ? '🎵' : '') + '</span></div>';
    const rows = list.map((w) => '<div class="card"><div class="row between"><div><b>' + esc(w.url) + '</b>' + (w.phrase ? ' <span class="muted">— ' + esc(w.phrase) + '</span>' : '') + (w.imgName ? ' <span class="muted">— 🖼 ' + esc(w.imgName) + '</span>' : '') + '<div class="muted">' + (w.lastResult ? esc(w.lastResult) : '—') + '</div></div></div><div class="row" style="margin-top:8px"><button class="btn ghost sm" data-check="' + w.id + '">' + esc(tr('check_now')) + '</button><button class="btn ghost sm" data-del="' + w.id + '">' + esc(tr('del')) + '</button></div></div>').join('');
    body.innerHTML = form + '<div style="margin-top:12px">' + (rows || '') + '</div>';

    let pickedImg = null;
    if (tab === 'img') body.querySelector('#d-pick').addEventListener('click', async () => { const f = await pickFile('image/*'); if (f) { pickedImg = f; body.querySelector('#d-imgname').textContent = f.name + ' (' + f.size + ' B)'; } });
    body.querySelector('#d-music').addEventListener('click', async () => { const f = await pickFile('audio/*'); if (f) { saveMusic(f.dataUrl); body.querySelector('#d-mname').textContent = '🎵 ' + f.name; } });
    body.querySelector('#d-mtest').addEventListener('click', () => playAlarmMusic());
    body.querySelector('#d-add').addEventListener('click', () => {
      const url = body.querySelector('#d-url').value.trim(); if (!url) return;
      const w = { id: 'w' + Date.now(), tab, url, lastCheck: 0, triggered: false };
      if (tab === 'text') { w.phrase = (body.querySelector('#d-ph').value || '').trim(); if (!w.phrase) return; }
      if (tab === 'img') { if (!pickedImg) return; w.refDataUrl = pickedImg.dataUrl; w.imgName = pickedImg.name; }
      const all = load(); all.push(w); save(all); draw();
    });
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { save(load().filter((w) => w.id !== b.getAttribute('data-del'))); draw(); }));
    body.querySelectorAll('[data-check]').forEach((b) => b.addEventListener('click', async () => {
      b.textContent = '…'; const all = load(); const w = all.find((x) => x.id === b.getAttribute('data-check')); if (!w) return;
      const res = await checkWatcher(w); w.lastCheck = Date.now(); w.lastResult = res.summary;
      if (res.trigger) { w.triggered = true; notify(res.title, res.body).catch(() => {}); playAlarmMusic(); }
      save(all); draw();
    }));
  }

  return wrap;
}
