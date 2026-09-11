// Version: 1.0023
// dosing.js — КАЛКУЛАТОР НА ДОЗАТА за най-честите лекарства без рецепта (Huawei 4.1, 11.09.2026):
// по тегло (mg/kg) и възраст, с таван на дозата за възрастни, интервал и дневен максимум; преизчислява
// в ml сироп (по концентрация) или брой таблетки. Стойностите са от публичните ОТС листовки (ЕС/САЩ) и са
// нарочно КОНСЕРВАТИВНИ. Само ориентировъчно — листовката на продукта и лекарят имат предимство.
// Всяко лекарство: { id, names, minMonths, perKg:[min,max] mg/kg, adult:[min,max] mg, everyH:[min,max],
//   maxPerDayKg mg/kg, maxPerDayAdult mg, maxDoses, forms:[{ id, kind:'tablet'|'syrup'|'drops'|'sachet', mg, perMl }], byAge:[…] }

export const OTC = [
  { id: 'paracetamol', names: { en: 'Paracetamol (acetaminophen)', bg: 'Парацетамол', ru: 'Парацетамол', uk: 'Парацетамол', de: 'Paracetamol', fr: 'Paracétamol', es: 'Paracetamol', it: 'Paracetamolo', pt: 'Paracetamol', ar: 'باراسيتامول', hi: 'पेरासिटामोल', ja: 'アセトアミノフェン', ky: 'Парацетамол', 'zh-Hant': '對乙醯氨基酚（普拿疼）' },
    minMonths: 3, perKg: [10, 15], adult: [500, 1000], adultFromKg: 50, adultFromYears: 12, everyH: [4, 6], maxPerDayKg: 60, maxPerDayAdult: 3000, maxDoses: 4,
    forms: [{ id: 't500', kind: 'tablet', mg: 500 }, { id: 't1000', kind: 'tablet', mg: 1000 }, { id: 's120', kind: 'syrup', perMl: 24, label: '120 mg / 5 ml' }, { id: 's250', kind: 'syrup', perMl: 50, label: '250 mg / 5 ml' }, { id: 'd100', kind: 'drops', perMl: 100, label: '100 mg / ml' }] },
  { id: 'ibuprofen', names: { en: 'Ibuprofen', bg: 'Ибупрофен', ru: 'Ибупрофен', uk: 'Ібупрофен', de: 'Ibuprofen', fr: 'Ibuprofène', es: 'Ibuprofeno', it: 'Ibuprofene', pt: 'Ibuprofeno', ar: 'إيبوبروفين', hi: 'आइबुप्रोफेन', ja: 'イブプロフェン', ky: 'Ибупрофен', 'zh-Hant': '布洛芬' },
    minMonths: 3, minKg: 5, perKg: [5, 10], adult: [200, 400], adultFromKg: 40, adultFromYears: 12, everyH: [6, 8], maxPerDayKg: 30, maxPerDayAdult: 1200, maxDoses: 3,
    forms: [{ id: 't200', kind: 'tablet', mg: 200 }, { id: 't400', kind: 'tablet', mg: 400 }, { id: 's100', kind: 'syrup', perMl: 20, label: '100 mg / 5 ml' }, { id: 's200', kind: 'syrup', perMl: 40, label: '200 mg / 5 ml' }] },
  { id: 'aspirin', names: { en: 'Aspirin (acetylsalicylic acid)', bg: 'Аспирин', ru: 'Аспирин', uk: 'Аспірин', de: 'Aspirin (ASS)', fr: 'Aspirine', es: 'Aspirina', it: 'Aspirina', pt: 'Aspirina', ar: 'أسبرين', hi: 'एस्पिरिन', ja: 'アスピリン', ky: 'Аспирин', 'zh-Hant': '阿斯匹靈' },
    minYears: 16, notUnder16: true, adult: [300, 600], adultFromYears: 16, everyH: [4, 6], maxPerDayAdult: 3000, maxDoses: 6,
    forms: [{ id: 't500', kind: 'tablet', mg: 500 }, { id: 't300', kind: 'tablet', mg: 300 }] },
  { id: 'cetirizine', names: { en: 'Cetirizine', bg: 'Цетиризин', ru: 'Цетиризин', uk: 'Цетиризин', de: 'Cetirizin', fr: 'Cétirizine', es: 'Cetirizina', it: 'Cetirizina', pt: 'Cetirizina', ar: 'سيتريزين', hi: 'सेटिरिज़िन', ja: 'セチリジン', ky: 'Цетиризин', 'zh-Hant': '西替利嗪' },
    minMonths: 24, byAge: [{ maxYears: 6, mg: 2.5, perDay: 2 }, { maxYears: 12, mg: 5, perDay: 2 }, { maxYears: 200, mg: 10, perDay: 1 }], everyH: [12, 24],
    forms: [{ id: 't10', kind: 'tablet', mg: 10 }, { id: 's1', kind: 'syrup', perMl: 1, label: '5 mg / 5 ml' }, { id: 'd10', kind: 'drops', perMl: 10, label: '10 mg / ml' }] },
  { id: 'loratadine', names: { en: 'Loratadine', bg: 'Лоратадин', ru: 'Лоратадин', uk: 'Лоратадин', de: 'Loratadin', fr: 'Loratadine', es: 'Loratadina', it: 'Loratadina', pt: 'Loratadina', ar: 'لوراتادين', hi: 'लोराटाडिन', ja: 'ロラタジン', ky: 'Лоратадин', 'zh-Hant': '氯雷他定' },
    minMonths: 24, byAge: [{ maxYears: 12, maxKg: 30, mg: 5, perDay: 1 }, { maxYears: 200, mg: 10, perDay: 1 }], everyH: [24, 24],
    forms: [{ id: 't10', kind: 'tablet', mg: 10 }, { id: 's1', kind: 'syrup', perMl: 1, label: '5 mg / 5 ml' }] },
  { id: 'loperamide', names: { en: 'Loperamide', bg: 'Лоперамид', ru: 'Лоперамид', uk: 'Лоперамід', de: 'Loperamid', fr: 'Lopéramide', es: 'Loperamida', it: 'Loperamide', pt: 'Loperamida', ar: 'لوبيراميد', hi: 'लोपरामाइड', ja: 'ロペラミド', ky: 'Лоперамид', 'zh-Hant': '洛哌丁胺' },
    minYears: 12, adult: [2, 4], adultFromYears: 12, everyH: [2, 4], maxPerDayAdult: 8, maxDoses: 4, note: 'first 4 mg, then 2 mg after each loose stool',
    forms: [{ id: 'c2', kind: 'tablet', mg: 2 }] },
  { id: 'ors', names: { en: 'Oral rehydration salts (ORS)', bg: 'Орални рехидратиращи соли', ru: 'Регидратационные соли (Регидрон)', uk: 'Регідратаційні солі', de: 'Orale Rehydratationslösung', fr: 'Sels de réhydratation orale', es: 'Sales de rehidratación oral', it: 'Sali reidratanti orali', pt: 'Sais de reidratação oral', ar: 'أملاح الإماهة الفموية', hi: 'ओआरएस घोल', ja: '経口補水塩', ky: 'Оозеки регидратация туздары', 'zh-Hant': '口服補液鹽' },
    ors: true, minMonths: 0, forms: [{ id: 'sachet', kind: 'sachet', dissolveMl: 200 }] }
];

// Пресмята. Вход: { drugId, kg, years, months, formId }. Изход: { ok, key/params за съобщение, doseMg:[min,max], everyH, maxDayMg, maxDoses, ml:[min,max], tablets:[min,max], capped, form }
export function calcDose(inp) {
  const d = OTC.find((x) => x.id === inp.drugId); if (!d) return { ok: false, reason: 'nodrug' };
  const kg = Math.max(0, parseFloat(inp.kg) || 0); const years = Math.max(0, parseFloat(inp.years) || 0); const months = Math.max(0, parseFloat(inp.months) || 0);
  const ageM = years * 12 + months; const ageY = ageM / 12;
  const form = d.forms.find((f) => f.id === inp.formId) || d.forms[0];
  if (d.ors) {
    const out = { ok: true, ors: true, form, initialMl: kg ? [Math.round(kg * 50), Math.round(kg * 100)] : null, perStoolMl: kg ? Math.round(kg * 10) : null };
    if (ageY >= 12 || kg >= 40) out.perStoolMl = [200, 400];
    return out;
  }
  if (d.notUnder16 && ageY < 16) return { ok: false, reason: 'notUnder16' };
  if (d.minYears && ageY < d.minYears) return { ok: false, reason: 'tooYoung', min: d.minYears + ' y' };
  if (d.minMonths != null && ageM < d.minMonths) return { ok: false, reason: 'tooYoung', min: d.minMonths + ' m' };
  if (d.minKg && kg && kg < d.minKg) return { ok: false, reason: 'tooYoung', min: d.minKg + ' kg' };
  if (!kg && !d.byAge && !(d.adult && ageY >= (d.adultFromYears || 12))) return { ok: false, reason: 'needWeight' };
  let dose = null, capped = false, perDay = d.maxDoses, everyH = d.everyH;
  if (d.byAge) {
    const row = d.byAge.find((r) => ageY < r.maxYears && (!r.maxKg || !kg || kg < r.maxKg)) || d.byAge[d.byAge.length - 1];
    dose = [row.mg, row.mg]; perDay = row.perDay; everyH = [Math.round(24 / row.perDay), Math.round(24 / row.perDay)];
  } else {
    const isAdult = ageY >= (d.adultFromYears || 12) || (d.adultFromKg && kg >= d.adultFromKg);
    if (isAdult && d.adult) { dose = d.adult.slice(); }
    else if (d.perKg && kg) { dose = [kg * d.perKg[0], kg * d.perKg[1]]; if (d.adult && dose[1] > d.adult[1]) { dose[1] = d.adult[1]; capped = true; } if (d.adult && dose[0] > d.adult[1]) dose[0] = d.adult[1]; }
    else if (d.adult) dose = d.adult.slice();
  }
  if (!dose) return { ok: false, reason: 'needWeight' };
  dose = dose.map((v) => Math.round(v / 5) * 5 || Math.round(v * 10) / 10);
  let maxDay = d.maxPerDayAdult || Infinity;
  if (d.maxPerDayKg && kg && ageY < (d.adultFromYears || 12)) maxDay = Math.min(maxDay, Math.round(kg * d.maxPerDayKg / 10) * 10);
  if (d.byAge) maxDay = dose[1] * perDay;
  if (!isFinite(maxDay)) maxDay = dose[1] * perDay;
  const out = { ok: true, drug: d, form, doseMg: dose, everyH, maxDayMg: maxDay, maxDoses: perDay, capped, note: d.note || '' };
  if (form.kind === 'syrup' || form.kind === 'drops') out.ml = dose.map((v) => Math.round(v / form.perMl * 10) / 10);
  if (form.kind === 'tablet') out.tablets = dose.map((v) => Math.round(v / form.mg * 4) / 4);
  return out;
}
export function otcName(d, lang) { return d.names[lang] || d.names[String(lang).split('-')[0]] || d.names.en; }
