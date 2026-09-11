import { mountLangGate as __mountLangGate } from './core/lang-gate.js';
import { LANGUAGES as __LG_L, getLang as __LG_G, setLang as __LG_S } from './core/i18n.js';
__mountLangGate({ languages: __LG_L, current: __LG_G(), setLang: __LG_S });
enforceLicense('pupikes-doctor', 'rustore'); // лог на инсталация СЛЕД езика (rustore билд)
// Version: 1.0023
// main.js — Pupikes Doctor: снимаш проблема (или описваш оплаквания) + размер/болка/честота →
// показва ВЪЗМОЖНИ съвпадения (сравнение по признаци + текст срещу база + снимка срещу вградена
// библиотека) + съвети „какво да направиш" и „кога към лекар".
// Задължителен медицински дисклеймър в началото. Стандартен хром: интро→език(15)→правен→футър.
//
// 1.0023 (11.09.2026 — невронно разпознаване на снимката, ВТОРИ глас):
//   • вграден невронен модел (MobileNetV3-Small, TensorFlow.js, ~3 MB, без интернет) смята отпечатък на снимката
//     и го сравнява с библиотека от вграждания (корпус + 100+ проверени снимки на състояние, пресметната при билд)
//     → „Снимката прилича на: X (62 %), Y (21 %), Z (9 %)" — топ-3 с вероятности;
//   • въпросникът остава ГЛАВЕН: вероятностите от снимката само добавят точки към състоянията;
//   • без модел (слаб телефон, грешка, липсващ файл) — старото сравнение по ръчни отпечатъци, с честна бележка.
//
// 1.0022 (Huawei 3.1, 11.09.2026 — „главната функция не може да се ползва"):
//   • снимковият корпус се зарежда ЛЕНИВО на части след първия екран (индикатор); анализът без снимка
//     не го чака изобщо; със снимка — ползва наличните части и казва, ако са частични/липсват;
//   • ясни съобщения при ВСЯКА грешка (снимка нечетима, библиотека недостъпна, превод недостъпен,
//     примерът не се зареди) — никакъв тих провал; на английски съветите са вградени (без мрежа);
//   • „Примерни случаи": 3 готови сценария (оплакване + снимка от тестовия набор) → резултат с едно докосване.
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
import { enforceLicense } from './core/license.js';
enforceLock();
mountEcosystem('pupikes-doctor');
playIntro();
startPromoAds('pupikes-doctor');
mountHelp('pupikes-doctor');
mountPrivacyLink('pupikes-doctor');
mountLegalGate('pupikes-doctor');
import './core/styles.css';
import { esc } from './core/ui.js';
import { getLang, setLang, hasLangChosen, applyDir, LANGUAGES } from './core/i18n.js';
import { APP_VERSION } from './version.js';
import { D, Df, optLabel, condName, AREA_OPTS, SIZE_OPTS, PAIN_OPTS, PAINTYPE_OPTS, FREQ_OPTS } from './doc/i18n-doc.js';
import { score, translate, imageMatches, conditionText, bodyPainText, photoSignal, photoBoost, preloadSignatures, corpusState, onCorpus, waitForCorpus, translateFailed, resetTranslateFlag, preloadNN, nnState, onNN, waitForNN } from './doc/analyze.js';
import { BODY_TYPES, renderBodySVG, causesFor, zoneLabel, EXTRA_ZONE_CHIPS } from './doc/body.js';
import { conditionPack, lastRawEmbedding, addLocalVectors } from './doc/analyze.js';
import { linksFor, openExternal } from './doc/links.js';
import { serverEnabled, setServerEnabled, condInfo, learn, fetchUpdates } from './doc/medikit.js';

const app = document.getElementById('app');
const DISC_KEY = 'doc.disclaimer.ok';
let photoFile = null;

function selHTML(id, opts) {
  return `<select id="${id}" class="search" style="margin:4px 0 8px">` +
    opts.map((o) => `<option value="${esc(o.v)}">${esc(optLabel(o))}</option>`).join('') + `</select>`;
}

// ── Примерни случаи (11.09.2026): реални снимки от тестовия набор (private/medikit-harvester/testsets/cond),
// вградени в public/samples/. Оплакването се показва на езика на потребителя (i18n), а за оценката се
// подава АНГЛИЙСКИЯТ текст (ключовите думи са bg+en) → примерът работи еднакво на всеки език и ОФЛАЙН.
const SAMPLES = [
  { id: 'abrasion', file: 'samples/case-abrasion.jpg', name: 'case_abrasion', text: 'case_abrasion_text', en: 'fell off the bike, knee scraped, abrasion, bleeds a little, stings when touched',
    area: 'knee', size: '1', pain: '1', ptype: 'burning', freq: 'touch' },
  { id: 'sunburn', file: 'samples/case-sunburn.jpg', name: 'case_sunburn', text: 'case_sunburn_text', en: 'after the beach my back and shoulders are red, hot and burning, sunburn',
    area: 'back', size: '2', pain: '2', ptype: 'burning', freq: 'touch' },
  { id: 'psoriasis', file: 'samples/case-psoriasis.jpg', name: 'case_psoriasis', text: 'case_psoriasis_text', en: 'red patch with silvery scales on the elbow, itchy, flaky plaque, psoriasis, for weeks',
    area: 'skin', size: '1', pain: '0', ptype: 'itching', freq: 'night' }
];

// Превод на най-честите дерматологични диагнози от снимковия корпус на разбираем български.
const DERMA_BG = {
  'nevus': 'бенка (невус)', 'melanoma': 'меланом', 'melanoma in situ': 'меланом (начален)',
  'melanoma invasive': 'инвазивен меланом', 'melanoma metastasis': 'меланомна метастаза',
  'seborrheic keratosis': 'себорейна кератоза', 'basal cell carcinoma': 'базоцелуларен карцином',
  'squamous cell carcinoma': 'плоскоклетъчен карцином', 'solar or actinic keratosis': 'слънчева (актинична) кератоза',
  'lichen planus like keratosis': 'кератоза', 'lentigo nos': 'лентиго (петно)', 'solar lentigo': 'слънчево петно',
  'lentigo simplex': 'лентиго', 'ink-spot lentigo': 'тъмно петно', 'dermatofibroma': 'дерматофибром',
  'hemangioma': 'хемангиом (съдово)', 'angiokeratoma': 'ангиокератом', 'neurofibroma': 'неврофибром',
  'scar': 'белег', 'verruca': 'брадавица', 'sebaceous hyperplasia': 'мастна хиперплазия',
  'clear cell acanthoma': 'акантом', 'skin lesion': 'кожна лезия', 'benign': 'доброкачествено образувание'
};
function dermaNameBg(lab) {
  const s = String(lab || '').toLowerCase().trim();
  if (DERMA_BG[s]) return DERMA_BG[s];
  if (/melanoma/.test(s)) return 'меланом';
  if (/carcinoma/.test(s)) return 'карцином (кожен)';
  if (/keratosis/.test(s)) return 'кератоза';
  if (/nevus|naevus/.test(s)) return 'бенка (невус)';
  if (/lentigo/.test(s)) return 'лентиго (петно)';
  return s;
}
// Име на етикет от корпуса за показване: bg → български речник; en → етикетът; други → превод (en→език).
async function dermaName(lab, lang) {
  if (lang === 'bg') return dermaNameBg(lab);
  if (lang === 'en') return String(lab || '');
  return await translate(String(lab || ''), lang, 'en');
}

// ---------- Език ----------
function renderLanguage() {
  app.innerHTML = `
    <div class="view">
      <div class="hero"><div style="font-size:2.4em">🌐</div><h1>Pupikes Doctor</h1></div>
      <div class="lang-grid" id="langgrid"></div>
      <button class="btn" id="startbtn" style="margin-top:16px">${esc(D('disclaimer_cont'))}</button>
      <div class="center" style="opacity:.55;font-size:12px;margin-top:6px">v${esc(APP_VERSION)}</div>
    </div>`;
  const cur = getLang();
  const grid = app.querySelector('#langgrid');
  grid.innerHTML = LANGUAGES.map((l) => `<button class="lang-btn${l.code === cur ? ' cur' : ''}" data-code="${l.code}">${esc(l.native)}</button>`).join('');
  const choose = (code) => { setLang(code); route(); };
  grid.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', () => choose(b.dataset.code)));
  app.querySelector('#startbtn').addEventListener('click', () => choose(cur));
}

// ---------- Медицински дисклеймър (еднократна отметка) ----------
function renderDisclaimer() {
  app.innerHTML = `
    <div class="view">
      <div class="hero"><div style="font-size:2.4em">⚕️</div><h1>${esc(D('disclaimer_title'))}</h1></div>
      <div class="notice" style="line-height:1.5">${esc(D('disclaimer_body'))}</div>
      <label style="display:flex;gap:10px;align-items:flex-start;margin:14px 2px;cursor:pointer">
        <input type="checkbox" id="agree" style="width:20px;height:20px;margin-top:2px">
        <span>${esc(D('disclaimer_agree'))}</span>
      </label>
      <button class="btn" id="cont" disabled style="opacity:.6">${esc(D('disclaimer_cont'))}</button>
    </div>`;
  const chk = app.querySelector('#agree'); const btn = app.querySelector('#cont');
  chk.addEventListener('change', () => { btn.disabled = !chk.checked; btn.style.opacity = chk.checked ? '1' : '.6'; });
  btn.addEventListener('click', () => { try { localStorage.setItem(DISC_KEY, '1'); } catch (_) {} renderHome(); });
}

// ---------- Състояние на снимковата библиотека (индикатор под бутона за снимка) ----------
function corpusLine(s) {
  s = s || corpusState();
  if (s.status === 'loading') return { cls: '', text: Df('corpus_loading', { n: Math.min(s.loaded + 1, s.total || 1), m: s.total || '…' }) };
  if (s.status === 'ready') return { cls: '', text: Df('corpus_ready', { n: s.n.toLocaleString() }) };
  if (s.status === 'partial') return { cls: 'warn', text: (s.error === 'lowmem' ? D('corpus_lowmem') + ' ' : '') + Df('corpus_partial', { n: s.n.toLocaleString() }) };
  if (s.status === 'error') return { cls: 'warn', text: Df('corpus_error', { e: s.error || '—' }) };
  return { cls: '', text: '' };
}
function paintCorpus(s) {
  const el = app.querySelector('#corpus'); if (!el) return;
  const L = corpusLine(s); el.textContent = L.text; el.style.color = L.cls === 'warn' ? '#e5a54d' : '';
}
onCorpus(paintCorpus);
// Състояние на невронния модел (1.0023) — втори ред под бутона за снимка; при 'off'/'error' казва причината
// и че се ползва старото сравнение.
function nnLine(s) {
  s = s || nnState();
  if (s.status === 'loading') return { cls: '', text: Df('nn_loading', { n: Math.min(s.loaded + 1, s.total || 1), m: s.total || '…' }) };
  if (s.status === 'ready') return { cls: '', text: Df('nn_ready', { n: s.n.toLocaleString() }) };
  if (s.status === 'off') return { cls: 'warn', text: D('nn_lowmem') };
  if (s.status === 'error') return { cls: 'warn', text: Df('nn_off', { e: s.reason || '—' }) };
  return { cls: '', text: '' };
}
function paintNN(s) {
  const el = app.querySelector('#nn'); if (!el) return;
  const L = nnLine(s); el.textContent = L.text; el.style.color = L.cls === 'warn' ? '#e5a54d' : '';
}
onNN(paintNN);

// ---------- Начален екран (2 режима: „Признаци/снимка" и „Къде боли") ----------
let homeMode = 'symptoms';
let bodyType = 'man';
function renderHome() {
  app.innerHTML = `
    <div class="view">
      <div class="hero">
        <button class="lang-toggle" id="langbtn">🌐</button>
        <h1>Pupikes Doctor</h1>
        <p>${esc(D('tagline'))}</p>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button class="btn modebtn" data-m="symptoms" style="flex:1">${esc(D('mode_symptoms'))}</button>
        <button class="btn modebtn" data-m="body" style="flex:1">${esc(D('mode_body'))}</button>
      </div>
      <div id="modehost"></div>
      <div class="notice" style="margin-top:16px;font-size:.82em;opacity:.85">${esc(D('disclaimer_title'))}: ${esc(D('disclaimer_body'))}</div>
    </div>`;
  app.querySelector('#langbtn').addEventListener('click', renderLanguage);
  const host = app.querySelector('#modehost');
  function paintMode() {
    app.querySelectorAll('.modebtn').forEach((b) => { const on = b.dataset.m === homeMode; b.style.background = on ? '#2f7d32' : ''; b.style.color = on ? '#fff' : ''; b.style.fontWeight = on ? '700' : ''; });
    if (homeMode === 'body') renderBody(host); else renderSymptoms(host);
  }
  app.querySelectorAll('.modebtn').forEach((b) => b.addEventListener('click', () => { homeMode = b.dataset.m; paintMode(); }));
  paintMode();
  // Снимковата библиотека тръгва СЛЕД първия рендер (екранът е готов веднага), на части, с индикатор.
  // После невронният модел (1.0023): библиотека от вграждания + TF.js — също лениво, с индикатор.
  // При включена настройка „сървър": веднъж на пускане — нови отпечатъци от сървъра → локалната библиотека.
  setTimeout(() => { preloadSignatures().catch(() => {}).then(() => preloadNN()).then(syncFromServer).catch(() => {}); }, 300);
}
async function syncFromServer() {
  if (!serverEnabled()) return;
  try {
    const items = await fetchUpdates(); if (!items.length) return;
    const n = addLocalVectors(items);
    const el = app.querySelector('#srvline'); if (el && n) el.textContent = Df('srv_updates', { n });
  } catch (_) {}
}

// ── Режим „Къде боли": фигура + кликаеми зони → възможни причини ──
function renderBody(host) {
  const lang = getLang();
  host.innerHTML = `
    <div class="hint" style="margin-bottom:6px">${esc(D('body_pick_type'))}</div>
    <div id="btypes" style="display:flex;gap:6px;margin-bottom:8px"></div>
    <div id="bfig"></div>
    <div class="hint" style="text-align:center;margin:4px 0">${esc(D('body_tap_hint'))}</div>
    <div class="hint">${esc(D('body_more_zones'))}</div>
    <div id="bchips" style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px"></div>
    <div id="bresult"></div>`;
  const typesEl = host.querySelector('#btypes'), fig = host.querySelector('#bfig');
  const chips = host.querySelector('#bchips'), result = host.querySelector('#bresult');
  typesEl.innerHTML = BODY_TYPES.map((t) => `<button class="btn btype" data-t="${t.id}" style="flex:1;padding:8px 4px;line-height:1.2">${t.emoji}<br><span style="font-size:.78em">${esc(t.label[lang] || t.label[String(lang).split('-')[0]] || t.label.en)}</span></button>`).join('');
  chips.innerHTML = EXTRA_ZONE_CHIPS.map((z) => `<button class="btn bchip" data-z="${z}" style="padding:6px 10px;font-size:.85em;background:#5b6472">${esc(zoneLabel(z, lang))}</button>`).join('');
  function paintTypes() { typesEl.querySelectorAll('.btype').forEach((b) => { const on = b.dataset.t === bodyType; b.style.background = on ? '#2f7d32' : ''; b.style.color = on ? '#fff' : ''; }); }
  function drawFig() { fig.innerHTML = renderBodySVG(bodyType); fig.querySelectorAll('.bz').forEach((el) => el.addEventListener('click', () => { fig.querySelectorAll('.bz').forEach((x) => x.style.filter = ''); el.style.filter = 'brightness(0.82)'; showZone(el.getAttribute('data-zone')); })); }
  async function showZone(zid) {
    const info = causesFor(zid, bodyType); if (!info) return;
    result.innerHTML = `<div class="hint">${esc(D('analyzing'))}</div>`;
    try {
      resetTranslateFlag();
      const title = zoneLabel(zid, lang);
      // bg → вградените; en → вградените английски (без мрежа); други → превод от английския (relay при нужда),
      // а ако преводът падне — английският текст + бележка.
      const base = String(lang).split('-')[0];
      const tr = base === 'bg' ? '• ' + info.causes.join('\n• ') : (base === 'en' ? '• ' + info.causesEn.join('\n• ') : await translate('• ' + info.causesEn.join('\n• '), lang, 'en'));
      let redHtml = '';
      if (info.red) { const rtr = base === 'bg' ? info.red : (base === 'en' ? info.redEn : await translate(info.redEn, lang, 'en')); redHtml = `<div style="margin-top:10px;border-left:4px solid #e5484d;background:rgba(229,72,77,.08);border-radius:8px;padding:8px 10px"><b style="color:#e5484d">${esc(D('body_redflag'))}</b> ${esc(rtr)}</div>`; }
      // Авторитетен текст от вградения пакет (Wikipedia, per език) — ако е наличен за зоната.
      let infoHtml = '';
      try { const wt = await bodyPainText(zid, lang); if (wt) infoHtml = `<div style="margin-top:10px;opacity:.9;line-height:1.5;border-top:1px solid rgba(127,127,127,.2);padding-top:8px">${esc(wt)}<div style="opacity:.55;font-size:.8em;margin-top:4px">Wikipedia</div></div>`; } catch (_) {}
      // Преводът е паднал (няма мрежа/relay) → казваме го, вместо тихо да покажем български.
      const trNote = translateFailed() ? `<div class="hint" style="color:#e5a54d;margin-top:8px">${esc(D('translate_offline'))}</div>` : '';
      result.innerHTML = `<div class="card" style="display:block;text-align:left;cursor:default">
        <h3 style="margin:0 0 6px">${esc(title)}</h3>
        <div style="font-weight:600;margin-bottom:4px">${esc(D('body_causes_title'))}:</div>
        <div style="line-height:1.6;white-space:pre-line">${esc(tr)}</div>${redHtml}${infoHtml}${trNote}</div>`;
    } catch (e) {
      result.innerHTML = `<div class="notice">${esc(D('err_generic'))} ${esc(String((e && e.message) || e))}</div>`;
    }
  }
  typesEl.querySelectorAll('.btype').forEach((b) => b.addEventListener('click', () => { bodyType = b.dataset.t; paintTypes(); drawFig(); result.innerHTML = ''; }));
  chips.querySelectorAll('.bchip').forEach((b) => b.addEventListener('click', () => showZone(b.dataset.z)));
  paintTypes(); drawFig();
}

// ── Режим „Признаци / снимка" (анализаторът) ──
function renderSymptoms(host) {
  host.innerHTML = `
      <div class="card" style="display:block;text-align:left;cursor:default;padding:10px 12px;margin-bottom:10px">
        <div style="font-weight:700;margin-bottom:2px">${esc(D('samples_title'))}</div>
        <div class="hint" style="margin:0 0 8px">${esc(D('samples_hint'))}</div>
        <div id="samples" style="display:flex;flex-wrap:wrap;gap:6px">${SAMPLES.map((s) => `<button class="btn sample" data-s="${s.id}" style="width:auto;flex:1 1 30%;padding:8px 6px;font-size:.85em;background:#5b6472">${esc(D(s.name))}</button>`).join('')}</div>
      </div>
      <label class="btn" id="photolbl" style="display:block;text-align:center">
        ${esc(D('photo_btn'))}
        <input type="file" id="photo" accept="image/*" capture="environment" style="display:none">
      </label>
      <div id="corpus" class="hint" style="margin:6px 0 0"></div>
      <div id="nn" class="hint" style="margin:2px 0 0"></div>
      <div id="thumb" style="margin:8px 0"></div>
      <label class="hint">${esc(D('area_label'))}</label>${selHTML('area', AREA_OPTS)}
      <label class="hint">${esc(D('size_label'))}</label>${selHTML('size', SIZE_OPTS)}
      <label class="hint">${esc(D('pain_label'))}</label>${selHTML('pain', PAIN_OPTS)}
      <label class="hint">${esc(D('ptype_label'))}</label>${selHTML('ptype', PAINTYPE_OPTS)}
      <label class="hint">${esc(D('freq_label'))}</label>${selHTML('freq', FREQ_OPTS)}
      <input class="search" id="text" type="text" placeholder="${esc(D('text_ph'))}" autocomplete="off" style="margin-top:6px">
      <button class="btn" id="analyzebtn" style="margin-top:10px">${esc(D('analyze_btn'))}</button>
      <div id="status" class="hint" style="margin-top:10px"></div>
      <div id="result" style="margin-top:12px"></div>
      <div class="card" style="display:block;text-align:left;cursor:default;padding:10px 12px;margin-top:14px">
        <div style="font-weight:700;margin-bottom:4px">🔗 ${esc(D('srv_title'))}</div>
        <div class="hint" style="margin:0 0 8px;line-height:1.45">${esc(D('srv_body'))}</div>
        <label style="display:flex;gap:10px;align-items:center;cursor:pointer"><input type="checkbox" id="srv" style="width:20px;height:20px"${serverEnabled() ? ' checked' : ''}><span>${esc(D('srv_toggle'))}</span></label>
        <div id="srvline" class="hint" style="margin-top:6px"></div>
      </div>`;
  const statusEl = host.querySelector('#status');
  const resultEl = host.querySelector('#result');
  const thumb = host.querySelector('#thumb');
  paintCorpus(); paintNN();
  // Настройка „сървър" (по избор, изключена по подразбиране): при включване — веднага сваля новите отпечатъци.
  host.querySelector('#srv').addEventListener('change', (e) => { setServerEnabled(!!e.target.checked); if (e.target.checked) syncFromServer(); });
  function showThumb() {
    if (!photoFile) { thumb.innerHTML = ''; return; }
    const u = URL.createObjectURL(photoFile);
    thumb.innerHTML = `<img src="${u}" style="max-width:100%;max-height:220px;border-radius:12px;display:block"><button class="btn inline" id="photoclear" style="margin-top:6px;padding:6px 12px;font-size:.85em;background:#5b6472">${esc(D('photo_clear'))}</button>`;
    thumb.querySelector('#photoclear').addEventListener('click', () => { photoFile = null; showThumb(); });
  }
  showThumb();
  host.querySelector('#photo').addEventListener('change', (e) => {
    photoFile = e.target.files && e.target.files[0];
    e.target.value = '';   // да се пусне пак 'change' при СЪЩАТА снимка
    showThumb();
  });
  host.querySelector('#analyzebtn').addEventListener('click', () => analyze({}));
  // Примерен случай: зарежда снимката (бъндъл-асет → File), попълва полетата и пуска анализа веднага.
  host.querySelectorAll('.sample').forEach((b) => b.addEventListener('click', async () => {
    const s = SAMPLES.find((x) => x.id === b.dataset.s); if (!s) return;
    statusEl.textContent = D('sample_loaded'); resultEl.innerHTML = '';
    try {
      const r = await fetch(s.file); if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      photoFile = new File([blob], s.file.split('/').pop(), { type: blob.type || 'image/jpeg' });
    } catch (e) {
      photoFile = null; statusEl.textContent = '';
      resultEl.innerHTML = `<div class="notice">${esc(D('sample_failed'))} (${esc(String((e && e.message) || e))})</div>`;
      return;
    }
    showThumb();
    host.querySelector('#area').value = s.area; host.querySelector('#size').value = s.size; host.querySelector('#pain').value = s.pain;
    host.querySelector('#ptype').value = s.ptype; host.querySelector('#freq').value = s.freq; host.querySelector('#text').value = D(s.text);
    await analyze({ sampleEn: s.en });
    try { resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
  }));

  async function analyze(opts) {
    opts = opts || {};
    const input = {
      area: app.querySelector('#area').value,
      size: parseInt(app.querySelector('#size').value, 10) || 0,
      painLevel: parseInt(app.querySelector('#pain').value, 10) || 0,
      freq: app.querySelector('#freq').value,
      ptype: app.querySelector('#ptype').value,
      text: app.querySelector('#text').value
    };
    const lang = getLang();
    statusEl.textContent = D('analyzing'); resultEl.innerHTML = '';
    resetTranslateFlag();
    const notes = [];   // бележки за всичко, което е пропуснато/паднало — показват се над резултата
    try {
      // Свободният текст на друг език → превод на български (базата е на bg+en), за да хванат ключовите думи.
      // При примерен случай английският текст се подава директно (без мрежа).
      let extraText = opts.sampleEn || '';
      if (!extraText && input.text.trim() && lang !== 'bg' && lang !== 'en') { try { extraText = await translate(input.text, 'bg', lang); } catch (_) {} }
      // Снимката: сравнение срещу числовия опис на корпуса (16 778 снимки). Ако библиотеката още се
      // зарежда — изчакваме до 8 s с индикатор; после работим с наличното. Без снимка нищо не се чака.
      let im = { conds: [], top: [], dermat: false, strong: false, skipped: true, reason: 'nophoto' };
      let boosts = {};
      if (photoFile) {
        let cs = corpusState();
        if (cs.status === 'idle' || cs.status === 'loading') { statusEl.textContent = D('waiting_corpus'); cs = await waitForCorpus(8000); }
        // Невронният модел (1.0023): ако още се зарежда — изчакваме до 10 s; ако не стане — старият път.
        let ns = nnState();
        if (ns.status === 'idle' || ns.status === 'loading') { statusEl.textContent = D('nn_waiting'); ns = await waitForNN(10000); }
        statusEl.textContent = D(ns.status === 'ready' ? 'analyzing_photo_nn' : 'analyzing_photo');
        try { const r = await imageMatches(photoFile); if (r) im = r; }
        catch (e) { im = { conds: [], top: [], dermat: false, strong: false, skipped: true, reason: 'error:' + String((e && e.message) || e) }; }
        try { console.log('[doctor] photo match', JSON.stringify({ neural: !!im.neural, probs: im.probs, top: im.top, votes: im.topCondVotes, minDist: im.minDist, strong: im.strong, conds: (im.conds || []).map((c) => c.id), skipped: im.skipped, reason: im.reason })); } catch (_) {}   // диагностика (logcat)
        if (im.skipped) {
          if (im.reason === 'unreadable') notes.push(D('photo_unreadable'));
          else if (im.reason === 'nocorpus') notes.push(D('photo_skipped') + (cs.error && cs.error !== 'lowmem' ? ' (' + cs.error + ')' : ''));
          else if (/^error:/.test(im.reason)) notes.push(D('err_generic') + ' ' + im.reason.slice(6));
        } else if (im.partial) notes.push(corpusLine(cs).text);
        // Моделът не е ползван (слаб телефон/грешка/изтекло време) → казваме го честно, старият път работи.
        if (!im.neural && ns.status !== 'ready') notes.push(nnLine(ns).text || D('nn_lowmem'));
        // Анализ на снимката: център-изрязване + цветови сигнал → подсказва вероятни състояния.
        try { const sig = await photoSignal(photoFile); boosts = photoBoost(sig); if (!sig && !notes.length) notes.push(D('photo_unreadable')); } catch (_) {}
        // Невронните вероятности = ВТОРИ глас: топ-3 добавят точки (до +4 при 100 %), въпросникът остава главен.
        if (im.neural && im.probs) for (const x of im.probs.slice(0, 3)) boosts[x.id] = (boosts[x.id] || 0) + 4 * x.p;
      }
      const imgHits = (im.conds || []).slice(0, 3);   // най-много 3 от снимката, за да не заливаме резултата
      let matches = score(input, boosts, extraText);
      // Съюз без дубли. Невронен път (1.0023): въпросникът (с прибавените точки от снимката) води, снимковите
      // топ-3 се добавят след него. Стар път: РЕД според УВЕРЕНОСТТА на корпуса: при СИЛНО съвпадение (много
      // от най-близките сочат едно състояние) водят снимковите съвпадения; при СЛАБО/двусмислено (напр.
      // следоперативна рана — няма аналог в дерматологичния корпус) водят цветовите/текстовите състояния.
      const seen = new Set();
      const ordered = (im.strong && !im.neural) ? [...imgHits, ...matches] : [...matches, ...imgHits];
      const all = ordered.filter((c) => c && !seen.has(c.id) && seen.add(c.id));
      // Какво каза снимката — прозрачно за потребителя (и за модератора): различна снимка → различен ред.
      if (photoFile && !im.skipped) {
        if (im.neural) {
          const pct = (p) => Math.round(p * 100) + ' %';
          const lst = (im.probs || []).slice(0, 3).filter((x) => x.p >= 0.05).map((x) => condName(x.id) + ' (' + pct(x.p) + ')');
          if (lst.length && im.strong) notes.push(D('photo_nn_result') + ' ' + lst.join(', ') + '. ' + D('photo_second_voice'));
          else if (lst.length) notes.push(D('photo_nn_result') + ' ' + lst.join(', ') + '. ' + D('photo_nn_unsure'));
          else notes.push(D('photo_nn_none'));
        } else if (im.strong && imgHits.length) notes.push(D('photo_result') + ' ' + imgHits.slice(0, 3).map((c) => condName(c.id)).join(', ') + '.');
        else notes.push(D('photo_weak'));
      }
      // Дерматологичен банер — САМО при силно съвпадение (иначе е гадаене върху случайни съседи).
      let dermaCard = '';
      if (im.dermat && im.strong && im.top && im.top.length) {
        const names = []; for (const t of im.top.slice(0, 4)) { const nm = await dermaName(t.label, lang); if (nm && names.indexOf(nm) < 0) names.push(nm); }
        dermaCard = `
          <div class="card" style="display:block;text-align:left;cursor:default;border-left:3px solid #e5a54d">
            <h3 style="margin:0 0 6px">🔬 ${esc(D('derma_title'))}</h3>
            <div style="opacity:.92;line-height:1.5">${esc(D('derma_body'))}</div>
            ${names.length ? `<div style="margin-top:8px;opacity:.7;font-size:.9em">${esc(D('derma_near'))} ${esc(names.join(', '))}</div>` : ''}
          </div>`;
      }
      const notesHtml = notes.length ? `<div class="hint" style="margin:0 0 8px;line-height:1.5">${notes.map((n) => '• ' + esc(n)).join('<br>')}</div>` : '';
      if (!all.length && !dermaCard) { statusEl.textContent = ''; resultEl.innerHTML = notesHtml + `<div class="notice">${esc(D('no_match'))}</div>`; return; }
      // Съветите на избрания език: en → вградени (без мрежа); bg → вградени; други → превод от английския
      // (MyMemory, при нужда през relay); ако преводът падне → английският текст + бележка.
      const cards = [];
      for (const c of all) {
        let advice, seeDoc;
        if (lang === 'bg' || !c.adviceEn) { advice = c.advice; seeDoc = c.seeDoctor; }
        else if (lang === 'en') { advice = c.adviceEn; seeDoc = c.seeDoctorEn; }
        else { advice = await translate(c.adviceEn, lang, 'en'); seeDoc = await translate(c.seeDoctorEn, lang, 'en'); }
        const info = await conditionText(c.id, lang);   // автентичен per-език текст от вградения пакет
        // „Повече за това" (1.0023): линкове по езика (Wikipedia на езика/en, MedlinePlus, NHS, MSD…) — отварят се в
        // системния браузър, нищо не се тегли. При включена настройка „сървър" — и линкове/резюме от сървъра.
        let links = [], summary = '';
        try { links = linksFor(c.id, lang, await conditionPack(c.id)); } catch (_) {}
        try { const si = await condInfo(c.id, lang); if (si) { summary = si.summary || ''; for (const l of si.links) if (!links.some((x) => x.url === l.url)) links.push(l); } } catch (_) {}
        const linksHtml = links.length ? `<div style="margin-top:10px"><div class="hint" style="margin-bottom:4px">${esc(D('more_about'))}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${links.map((l) => `<a class="btn inline morelink" href="${esc(l.url)}" target="_blank" rel="noopener" style="padding:6px 10px;font-size:.82em;background:#5b6472;text-decoration:none">${esc(l.name)}${l.search ? ' · ' + esc(D('link_search')) : ''}</a>`).join('')}</div></div>` : '';
        const sumHtml = summary ? `<div style="margin-top:8px;opacity:.9;line-height:1.5"><b>${esc(D('srv_summary'))}</b> ${esc(summary)}</div>` : '';
        // „✓ Това беше" — само при анализирана снимка и включена настройка: отпечатъкът → локална библиотека + сървър.
        const confirmHtml = (photoFile && im.neural && serverEnabled()) ? `<div style="margin-top:8px"><button class="btn inline confirm" data-c="${esc(c.id)}" style="padding:6px 12px;font-size:.85em;background:#2f7d32">${esc(D('confirm_btn'))} — ${esc(condName(c.id))}</button><div class="hint confirm-note" style="margin-top:4px"></div></div>` : '';
        cards.push(`
          <div class="card" style="display:block;text-align:left;cursor:default">
            <h3 style="margin:0 0 6px">${esc(condName(c.id))}</h3>
            ${info ? `<div style="margin-top:2px;opacity:.92;line-height:1.5">${esc(info)}</div>` : ''}
            <div style="margin-top:8px"><b>${esc(D('res_advice'))}:</b> ${esc(advice)}</div>
            <div style="margin-top:8px;color:#e5a54d"><b>${esc(D('res_seedoctor'))}:</b> ${esc(seeDoc)}</div>
            ${sumHtml}${linksHtml}${confirmHtml}
          </div>`);
      }
      const trNote = translateFailed() ? `<div class="hint" style="color:#e5a54d;margin:0 0 8px">${esc(D('translate_offline'))}</div>` : '';
      statusEl.textContent = '';
      resultEl.innerHTML = `<div style="font-weight:700;margin:4px 0 8px">${esc(D('res_title'))}</div>` + notesHtml + trNote + dermaCard + cards.join('');
      resultEl.querySelectorAll('.morelink').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openExternal(a.getAttribute('href')); }));
      resultEl.querySelectorAll('.confirm').forEach((b) => b.addEventListener('click', async () => {
        const raw = lastRawEmbedding(); const note = b.parentElement.querySelector('.confirm-note'); if (!raw) return;
        b.disabled = true; const label = b.dataset.c;
        try { addLocalVectors([{ raw, label }]); } catch (_) {}
        const ok = await learn(raw, label, lang);
        note.textContent = ok ? D('confirm_done') : D('confirm_local');
      }));
    } catch (e) {
      // Никакъв тих провал: каквото и да гръмне — казваме го.
      statusEl.textContent = '';
      resultEl.innerHTML = `<div class="notice">${esc(D('err_generic'))} ${esc(String((e && e.message) || e))}</div>`;
    }
  }
}

// ---------- Рутер ----------
function route() {
  window.scrollTo(0, 0);
  if (!hasLangChosen()) return renderLanguage();
  let ok = false; try { ok = localStorage.getItem(DISC_KEY) === '1'; } catch (_) {}
  if (!ok) return renderDisclaimer();
  renderHome();
}

applyDir();
route();
