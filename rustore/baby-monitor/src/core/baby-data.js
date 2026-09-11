// Version: 1.0026
// baby-data.js — вградени справочни таблици (без мрежа):
//   • ориентировъчни СЗО граници за тегло/ръст по възраст (0–24 месеца, момчета/момичета):
//     P3 (долна граница), медиана, P97 (горна граница), стъпка 1 месец;
//   • типична схема на ваксините за първите 2 години (по СЗО; националният календар има предимство).
// Стойностите са закръглени ориентири за родителя — НЕ заместват лекар.

// Тегло (кг) — индекс = възраст в месеци.
const W_BOY = {
  p3:  [2.5,3.4,4.3,5.0,5.6,6.0,6.4,6.7,6.9,7.1,7.4,7.6,7.7,7.9,8.1,8.3,8.4,8.6,8.8,8.9,9.1,9.2,9.4,9.5,9.7],
  med: [3.3,4.5,5.6,6.4,7.0,7.5,7.9,8.3,8.6,8.9,9.2,9.4,9.6,9.9,10.1,10.3,10.5,10.7,10.9,11.1,11.3,11.5,11.8,12.0,12.2],
  p97: [4.4,5.8,7.1,8.0,8.7,9.3,9.8,10.3,10.7,11.0,11.4,11.7,12.0,12.3,12.6,12.8,13.1,13.4,13.7,13.9,14.2,14.5,14.7,15.0,15.3]
};
const W_GIRL = {
  p3:  [2.4,3.2,3.9,4.5,5.0,5.4,5.7,6.0,6.3,6.5,6.7,6.9,7.0,7.2,7.4,7.6,7.7,7.9,8.1,8.2,8.4,8.6,8.7,8.9,9.0],
  med: [3.2,4.2,5.1,5.8,6.4,6.9,7.3,7.6,7.9,8.2,8.5,8.7,8.9,9.2,9.4,9.6,9.8,10.0,10.2,10.4,10.6,10.9,11.1,11.3,11.5],
  p97: [4.2,5.5,6.6,7.5,8.2,8.8,9.3,9.8,10.2,10.5,10.9,11.2,11.5,11.8,12.1,12.4,12.6,12.9,13.2,13.5,13.7,14.0,14.3,14.6,14.8]
};
// Ръст / дължина (см).
const H_BOY = {
  p3:  [46.1,50.8,54.4,57.3,59.7,61.7,63.3,64.8,66.2,67.5,68.7,69.9,71.0,72.1,73.1,74.1,75.0,76.0,76.9,77.7,78.6,79.4,80.2,81.0,81.7],
  med: [49.9,54.7,58.4,61.4,63.9,65.9,67.6,69.2,70.6,72.0,73.3,74.5,75.7,76.9,78.0,79.1,80.2,81.2,82.3,83.2,84.2,85.1,86.0,86.9,87.8],
  p97: [53.7,58.6,62.4,65.5,68.0,70.1,71.9,73.5,75.0,76.5,77.9,79.2,80.5,81.8,83.0,84.2,85.4,86.5,87.7,88.8,89.8,90.9,91.9,92.9,93.9]
};
const H_GIRL = {
  p3:  [45.4,49.8,53.0,55.6,57.8,59.6,61.2,62.7,64.0,65.3,66.5,67.7,68.9,70.0,71.0,72.0,73.0,74.0,74.9,75.8,76.7,77.5,78.4,79.2,80.0],
  med: [49.1,53.7,57.1,59.8,62.1,64.0,65.7,67.3,68.7,70.1,71.5,72.8,74.0,75.2,76.4,77.5,78.6,79.7,80.7,81.7,82.7,83.7,84.6,85.5,86.4],
  p97: [52.9,57.6,61.1,64.0,66.4,68.5,70.3,71.9,73.5,75.0,76.4,77.8,79.2,80.5,81.7,83.0,84.2,85.4,86.5,87.6,88.7,89.8,90.8,91.9,92.9]
};

export const WHO_MAX_MONTHS = 24;

// Връща таблицата { p3, med, p97 } за мярка ('weight' | 'height') и пол ('boy' | 'girl').
export function whoTable(measure, sex) {
  if (measure === 'height') return sex === 'girl' ? H_GIRL : H_BOY;
  return sex === 'girl' ? W_GIRL : W_BOY;
}

// Линейна интерполация на границата за дробна възраст в месеци (0..24).
export function whoAt(measure, sex, months) {
  const tb = whoTable(measure, sex);
  const m = Math.max(0, Math.min(WHO_MAX_MONTHS, months));
  const i = Math.floor(m), f = m - i, j = Math.min(WHO_MAX_MONTHS, i + 1);
  const lerp = (a) => a[i] + (a[j] - a[i]) * f;
  return { p3: lerp(tb.p3), med: lerp(tb.med), p97: lerp(tb.p97) };
}

// Възраст в месеци (дробна) между дата на раждане и дата на измерване.
export function ageMonths(birthISO, atISO) {
  const b = new Date(birthISO), a = new Date(atISO || Date.now());
  if (isNaN(b) || isNaN(a)) return null;
  return Math.max(0, (a - b) / (1000 * 60 * 60 * 24 * 30.4375));
}

// 'low' | 'ok' | 'high' спрямо коридора P3–P97 (null ако извън таблицата/няма данни).
export function whoBand(measure, sex, months, value) {
  if (months == null || months > WHO_MAX_MONTHS || !(value > 0)) return null;
  const r = whoAt(measure, sex, months);
  if (value < r.p3) return 'low';
  if (value > r.p97) return 'high';
  return 'ok';
}

// Типична схема на ваксините (месеци). id = ключ за отметка „направена"; name = i18n ключ.
// 0 = при раждане. Схемата е обобщена по препоръките на СЗО за първите 2 години.
export const VACCINES = [
  { id: 'bcg-1',   name: 'vx_bcg',   dose: 1, month: 0 },
  { id: 'hepb-1',  name: 'vx_hepb',  dose: 1, month: 0 },
  { id: 'hepb-2',  name: 'vx_hepb',  dose: 2, month: 1 },
  { id: 'dtp-1',   name: 'vx_dtp',   dose: 1, month: 2 },
  { id: 'polio-1', name: 'vx_polio', dose: 1, month: 2 },
  { id: 'hib-1',   name: 'vx_hib',   dose: 1, month: 2 },
  { id: 'pcv-1',   name: 'vx_pcv',   dose: 1, month: 2 },
  { id: 'rota-1',  name: 'vx_rota',  dose: 1, month: 2 },
  { id: 'dtp-2',   name: 'vx_dtp',   dose: 2, month: 4 },
  { id: 'polio-2', name: 'vx_polio', dose: 2, month: 4 },
  { id: 'hib-2',   name: 'vx_hib',   dose: 2, month: 4 },
  { id: 'pcv-2',   name: 'vx_pcv',   dose: 2, month: 4 },
  { id: 'rota-2',  name: 'vx_rota',  dose: 2, month: 4 },
  { id: 'dtp-3',   name: 'vx_dtp',   dose: 3, month: 6 },
  { id: 'polio-3', name: 'vx_polio', dose: 3, month: 6 },
  { id: 'hib-3',   name: 'vx_hib',   dose: 3, month: 6 },
  { id: 'hepb-3',  name: 'vx_hepb',  dose: 3, month: 6 },
  { id: 'mmr-1',   name: 'vx_mmr',   dose: 1, month: 12 },
  { id: 'pcv-3',   name: 'vx_pcv',   dose: 3, month: 12 },
  { id: 'var-1',   name: 'vx_var',   dose: 1, month: 12 },
  { id: 'dtp-4',   name: 'vx_dtp',   dose: 4, month: 18 },
  { id: 'polio-4', name: 'vx_polio', dose: 4, month: 18 },
  { id: 'hib-4',   name: 'vx_hib',   dose: 4, month: 18 }
];
