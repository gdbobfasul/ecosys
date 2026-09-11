// Version: 1.0000
// „Локация QR" — координати (geo:) или линк към карта; сканиране отваря картата/навигацията.
// „Моята локация" ползва GPS (по избор). Изцяло на устройството.
import QRCode from 'qrcode';
import { esc, downloadBlob } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  qg_lat:  { bg:'Ширина (lat)', ru:'Широта (lat)', uk:'Широта (lat)', en:'Latitude', de:'Breite (lat)', fr:'Latitude', es:'Latitud', 'es-MX':'Latitud', it:'Latitudine', pt:'Latitude', ar:'خط العرض', hi:'अक्षांश', ja:'緯度', ky:'Кеңдик (lat)', 'zh-Hant':'緯度' },
  qg_lng:  { bg:'Дължина (lng)', ru:'Долгота (lng)', uk:'Довгота (lng)', en:'Longitude', de:'Länge (lng)', fr:'Longitude', es:'Longitud', 'es-MX':'Longitud', it:'Longitudine', pt:'Longitude', ar:'خط الطول', hi:'देशांतर', ja:'経度', ky:'Узундук (lng)', 'zh-Hant':'經度' },
  qg_mode: { bg:'Формат', ru:'Формат', uk:'Формат', en:'Format', de:'Format', fr:'Format', es:'Formato', 'es-MX':'Formato', it:'Formato', pt:'Formato', ar:'الصيغة', hi:'फ़ॉर्मेट', ja:'形式', ky:'Формат', 'zh-Hant':'格式' },
  qg_geo:  { bg:'geo: (навигация)', ru:'geo: (навигация)', uk:'geo: (навігація)', en:'geo: (navigation)', de:'geo: (Navigation)', fr:'geo: (navigation)', es:'geo: (navegación)', 'es-MX':'geo: (navegación)', it:'geo: (navigazione)', pt:'geo: (navegação)', ar:'geo: (ملاحة)', hi:'geo: (नेविगेशन)', ja:'geo:（ナビ）', ky:'geo: (навигация)', 'zh-Hant':'geo:（導航）' },
  qg_map:  { bg:'Линк към карта', ru:'Ссылка на карту', uk:'Посилання на карту', en:'Map link', de:'Karten-Link', fr:'Lien carte', es:'Enlace de mapa', 'es-MX':'Enlace de mapa', it:'Link mappa', pt:'Link do mapa', ar:'رابط الخريطة', hi:'मानचित्र लिंक', ja:'地図リンク', ky:'Карта шилтемеси', 'zh-Hant':'地圖連結' },
  qg_my:   { bg:'Моята локация (GPS)', ru:'Моё местоположение (GPS)', uk:'Моє місцезнаходження (GPS)', en:'My location (GPS)', de:'Mein Standort (GPS)', fr:'Ma position (GPS)', es:'Mi ubicación (GPS)', 'es-MX':'Mi ubicación (GPS)', it:'La mia posizione (GPS)', pt:'Minha localização (GPS)', ar:'موقعي (GPS)', hi:'मेरा स्थान (GPS)', ja:'現在地 (GPS)', ky:'Менин жайым (GPS)', 'zh-Hant':'我的位置 (GPS)' },
  qg_gen:  { bg:'Генерирай', ru:'Создать', uk:'Створити', en:'Generate', de:'Erstellen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'إنشاء', hi:'बनाएं', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  qg_dl:   { bg:'Свали PNG', ru:'Скачать PNG', uk:'Завантажити PNG', en:'Download PNG', de:'PNG laden', fr:'Télécharger PNG', es:'Descargar PNG', 'es-MX':'Descargar PNG', it:'Scarica PNG', pt:'Baixar PNG', ar:'تنزيل PNG', hi:'PNG डाउनलोड', ja:'PNG保存', ky:'PNG жүктөө', 'zh-Hant':'下載 PNG' },
  qg_need: { bg:'Въведи координати.', ru:'Введи координаты.', uk:'Введи координати.', en:'Enter coordinates.', de:'Koordinaten eingeben.', fr:'Saisis les coordonnées.', es:'Introduce coordenadas.', 'es-MX':'Introduce coordenadas.', it:'Inserisci le coordinate.', pt:'Insira as coordenadas.', ar:'أدخل الإحداثيات.', hi:'निर्देशांक दर्ज करें।', ja:'座標を入力。', ky:'Координаттарды киргиз.', 'zh-Hant':'請輸入座標。' },
  qg_gpserr:{ bg:'GPS недостъпен.', ru:'GPS недоступен.', uk:'GPS недоступний.', en:'GPS unavailable.', de:'GPS nicht verfügbar.', fr:'GPS indisponible.', es:'GPS no disponible.', 'es-MX':'GPS no disponible.', it:'GPS non disponibile.', pt:'GPS indisponível.', ar:'GPS غير متاح.', hi:'GPS उपलब्ध नहीं।', ja:'GPSが使えません。', ky:'GPS жеткиликсиз.', 'zh-Hant':'GPS 無法使用。' },
});

export const title = 'Location QR';

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('qg_lat'))}</span><input id="qg-lat" inputmode="decimal" placeholder="42.6977"></label>
    <label class="fld"><span>${esc(t('qg_lng'))}</span><input id="qg-lng" inputmode="decimal" placeholder="23.3219"></label>
    <label class="fld"><span>${esc(t('qg_mode'))}</span><select id="qg-mode"><option value="geo">${esc(t('qg_geo'))}</option><option value="map">${esc(t('qg_map'))}</option></select></label>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="qg-my">${esc(t('qg_my'))}</button><button class="btn primary" id="qg-gen">${esc(t('qg_gen'))}</button></div>
    <div style="text-align:center;margin-top:12px"><canvas id="qg-cv" style="max-width:100%;background:#fff;border-radius:12px;padding:10px;display:none"></canvas></div>
    <div style="text-align:center"><button class="btn" id="qg-dl" style="display:none;margin-top:8px">${esc(t('qg_dl'))}</button></div>`;
  const cv = root.querySelector('#qg-cv'), dl = root.querySelector('#qg-dl');
  root.querySelector('#qg-my').onclick = () => {
    if (!navigator.geolocation) { alert(t('qg_gpserr')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { root.querySelector('#qg-lat').value = p.coords.latitude.toFixed(6); root.querySelector('#qg-lng').value = p.coords.longitude.toFixed(6); },
      () => alert(t('qg_gpserr')), { timeout: 10000 });
  };
  root.querySelector('#qg-gen').onclick = async () => {
    const lat = root.querySelector('#qg-lat').value.trim(), lng = root.querySelector('#qg-lng').value.trim();
    if (!lat || !lng || isNaN(+lat) || isNaN(+lng)) { alert(t('qg_need')); return; }
    const str = root.querySelector('#qg-mode').value === 'map' ? `https://www.google.com/maps?q=${lat},${lng}` : `geo:${lat},${lng}`;
    try { await QRCode.toCanvas(cv, str, { width: 320, margin: 2, errorCorrectionLevel: 'M' }); cv.style.display = 'inline-block'; dl.style.display = 'inline-block'; } catch (e) { alert(String(e)); }
  };
  dl.onclick = () => cv.toBlob((b) => { if (b) downloadBlob(b, 'location-qr.png', 'image/png'); }, 'image/png');
}
