// Version: 1.0000
// „Времеви печат" — Unix timestamp (сек/мсек) ↔ човешка дата (локална + UTC + ISO). „Сега" бутон.
import { esc } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  ts_in:   { bg:'Timestamp или дата', ru:'Timestamp или дата', uk:'Timestamp або дата', en:'Timestamp or date', de:'Timestamp oder Datum', fr:'Timestamp ou date', es:'Timestamp o fecha', 'es-MX':'Timestamp o fecha', it:'Timestamp o data', pt:'Timestamp ou data', ar:'الطابع الزمني أو التاريخ', hi:'टाइमस्टैम्प या तिथि', ja:'タイムスタンプまたは日付', ky:'Timestamp же дата', 'zh-Hant':'時間戳或日期' },
  ts_now:  { bg:'Сега', ru:'Сейчас', uk:'Зараз', en:'Now', de:'Jetzt', fr:'Maintenant', es:'Ahora', 'es-MX':'Ahora', it:'Ora', pt:'Agora', ar:'الآن', hi:'अभी', ja:'現在', ky:'Азыр', 'zh-Hant':'現在' },
  ts_conv: { bg:'Преобразувай', ru:'Преобразовать', uk:'Перетворити', en:'Convert', de:'Umwandeln', fr:'Convertir', es:'Convertir', 'es-MX':'Convertir', it:'Converti', pt:'Converter', ar:'حوّل', hi:'बदलें', ja:'変換', ky:'Айландыруу', 'zh-Hant':'轉換' },
  ts_unix: { bg:'Unix (сек)', ru:'Unix (сек)', uk:'Unix (сек)', en:'Unix (sec)', de:'Unix (Sek.)', fr:'Unix (sec)', es:'Unix (seg)', 'es-MX':'Unix (seg)', it:'Unix (sec)', pt:'Unix (seg)', ar:'Unix (ثانية)', hi:'Unix (सेक)', ja:'Unix (秒)', ky:'Unix (сек)', 'zh-Hant':'Unix（秒）' },
  ts_ms:   { bg:'Unix (мсек)', ru:'Unix (мсек)', uk:'Unix (мсек)', en:'Unix (ms)', de:'Unix (ms)', fr:'Unix (ms)', es:'Unix (ms)', 'es-MX':'Unix (ms)', it:'Unix (ms)', pt:'Unix (ms)', ar:'Unix (مللي)', hi:'Unix (ms)', ja:'Unix (ミリ秒)', ky:'Unix (мс)', 'zh-Hant':'Unix（毫秒）' },
  ts_local:{ bg:'Локално време', ru:'Местное время', uk:'Місцевий час', en:'Local time', de:'Ortszeit', fr:'Heure locale', es:'Hora local', 'es-MX':'Hora local', it:'Ora locale', pt:'Hora local', ar:'التوقيت المحلي', hi:'स्थानीय समय', ja:'現地時間', ky:'Жергиликтүү убакыт', 'zh-Hant':'當地時間' },
  ts_utc:  { bg:'UTC', ru:'UTC', uk:'UTC', en:'UTC', de:'UTC', fr:'UTC', es:'UTC', 'es-MX':'UTC', it:'UTC', pt:'UTC', ar:'UTC', hi:'UTC', ja:'UTC', ky:'UTC', 'zh-Hant':'UTC' },
  ts_iso:  { bg:'ISO 8601', ru:'ISO 8601', uk:'ISO 8601', en:'ISO 8601', de:'ISO 8601', fr:'ISO 8601', es:'ISO 8601', 'es-MX':'ISO 8601', it:'ISO 8601', pt:'ISO 8601', ar:'ISO 8601', hi:'ISO 8601', ja:'ISO 8601', ky:'ISO 8601', 'zh-Hant':'ISO 8601' },
  ts_err:  { bg:'Неразпозната стойност.', ru:'Значение не распознано.', uk:'Значення не розпізнано.', en:'Value not recognized.', de:'Wert nicht erkannt.', fr:'Valeur non reconnue.', es:'Valor no reconocido.', 'es-MX':'Valor no reconocido.', it:'Valore non riconosciuto.', pt:'Valor não reconhecido.', ar:'القيمة غير معروفة.', hi:'मान नहीं पहचाना।', ja:'値を認識できません。', ky:'Маани таанылган жок.', 'zh-Hant':'無法辨識數值。' },
});

export const title = 'Timestamp';

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('ts_in'))}</span><input id="ts-in" placeholder="1700000000 / 2026-08-09 12:00"></label>
    <div style="display:flex;gap:8px"><button class="btn primary" id="ts-conv">${esc(t('ts_conv'))}</button><button class="btn" id="ts-now">${esc(t('ts_now'))}</button></div>
    <div id="ts-out" style="margin-top:12px"></div>`;
  const show = (d) => {
    const out = root.querySelector('#ts-out');
    if (!d || isNaN(d.getTime())) { out.innerHTML = `<div style="color:#f85149">${esc(t('ts_err'))}</div>`; return; }
    const row = (l, v) => `<div style="display:flex;gap:10px;margin:4px 0"><span style="width:38%;color:#8ecae6">${esc(l)}</span><span class="card" style="flex:1;user-select:all;padding:6px 8px">${esc(v)}</span></div>`;
    out.innerHTML = row(t('ts_unix'), Math.floor(d.getTime() / 1000)) + row(t('ts_ms'), d.getTime())
      + row(t('ts_local'), d.toLocaleString()) + row(t('ts_utc'), d.toUTCString()) + row(t('ts_iso'), d.toISOString());
  };
  root.querySelector('#ts-now').onclick = () => { const d = new Date(); root.querySelector('#ts-in').value = Math.floor(d.getTime() / 1000); show(d); };
  root.querySelector('#ts-conv').onclick = () => {
    const raw = root.querySelector('#ts-in').value.trim();
    if (/^\d{9,}$/.test(raw)) { const num = +raw; show(new Date(raw.length > 12 ? num : num * 1000)); }
    else show(new Date(raw));
  };
}
