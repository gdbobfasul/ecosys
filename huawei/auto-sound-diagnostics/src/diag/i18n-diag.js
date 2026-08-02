// Version: 1.0001
// i18n-diag.js — текстове за Auto Sound Diagnostics. Пълни: bg/ru/en; другите падат на en и се
// довеждат до 15 при нужда (резултатите се превеждат динамично в analyze.translate). getLang() от core.
import { getLang } from '../core/i18n.js';

const S = {
  tagline: {
    bg: 'Чуй колата → запиши звука → възможна причина',
    ru: 'Послушай машину → запиши звук → возможная причина',
    en: 'Listen to the car → record the sound → possible cause'
  },
  title: { bg: 'Auto Sound Diagnostics', ru: 'Auto Sound Diagnostics', en: 'Auto Sound Diagnostics' },
  where_label: { bg: 'Откъде идва звукът?', ru: 'Откуда идёт звук?', en: 'Where is the sound from?' },
  when_label: { bg: 'Кога се чува?', ru: 'Когда слышно?', en: 'When do you hear it?' },
  record_btn: { bg: '🎙️ Запиши и анализирай', ru: '🎙️ Записать и анализировать', en: '🎙️ Record & analyze' },
  recording: { bg: 'Слушам… дръж телефона близо до звука', ru: 'Слушаю… держи телефон ближе к звуку', en: 'Listening… hold the phone near the sound' },
  analyzing: { bg: 'Анализирам звука…', ru: 'Анализирую звук…', en: 'Analyzing the sound…' },
  res_title: { bg: 'Възможни причини', ru: 'Возможные причины', en: 'Possible causes' },
  res_cause: { bg: 'Какво чувам', ru: 'Что слышно', en: 'What I hear' },
  res_advice: { bg: 'Какво да направиш', ru: 'Что делать', en: 'What to do' },
  confidence: { bg: 'Близост', ru: 'Близость', en: 'Match' },
  again_btn: { bg: '↺ Нов запис', ru: '↺ Новая запись', en: '↺ New recording' },
  no_mic: {
    bg: 'Няма достъп до микрофона. Разреши микрофона за приложението и опитай пак.',
    ru: 'Нет доступа к микрофону. Разреши микрофон для приложения и попробуй снова.',
    en: 'No microphone access. Allow the microphone for the app and try again.'
  },
  tip: {
    bg: 'Съвет: запиши 4–5 секунди възможно най-близо до източника, в момента, когато звукът се чува най-силно.',
    ru: 'Совет: запиши 4–5 секунд как можно ближе к источнику, когда звук слышен сильнее всего.',
    en: 'Tip: record 4–5 seconds as close to the source as possible, when the sound is loudest.'
  },
  urgency_info: { bg: 'ℹ️ За сведение', ru: 'ℹ️ К сведению', en: 'ℹ️ For info' },
  urgency_soon: { bg: '🟠 Провери скоро', ru: '🟠 Проверь скоро', en: '🟠 Check soon' },
  urgency_urgent: { bg: '🔴 Спешно — провери веднага', ru: '🔴 Срочно — проверь немедленно', en: '🔴 Urgent — check now' },
  // Екран за съгласие (безопасност + отговорност)
  disc_title: { bg: '🔧 Важно — прочети', ru: '🔧 Важно — прочти', en: '🔧 Important — read' },
  disc_body: {
    bg: 'Това приложение НЕ поставя точна диагноза и НЕ е замяна на автомонтьор. Анализът на звука е чисто ориентировъчен и може да греши. Не използвай приложението, докато шофираш — записвай на спряла и обезопасена кола. За реален проблем се обърни към квалифициран специалист. Използваш информацията на своя отговорност.',
    ru: 'Это приложение НЕ ставит точный диагноз и НЕ заменяет автомеханика. Анализ звука ориентировочный и может ошибаться. Не используй приложение за рулём — записывай на остановленной и безопасной машине. При реальной проблеме обратись к специалисту. Используешь информацию на свой риск.',
    en: 'This app does NOT provide an exact diagnosis and is NOT a replacement for a mechanic. The sound analysis is only a rough guide and can be wrong. Do not use it while driving — record with the car stopped and safe. For a real problem consult a qualified specialist. You use the information at your own risk.'
  },
  disc_agree: { bg: 'Разбрах — ориентировъчно, на своя отговорност', ru: 'Понятно — ориентировочно, на свой риск', en: 'I understand — a rough guide, at my own risk' },
  cont: { bg: 'Продължи', ru: 'Продолжить', en: 'Continue' }
};

// Опции „къде" и „кога" — стойност + етикет.
const WHERE_LBL = {
  engine: { bg: 'Двигател', ru: 'Двигатель', en: 'Engine' },
  wheels: { bg: 'Колела/ходова', ru: 'Колёса/ходовая', en: 'Wheels/running gear' },
  brakes: { bg: 'Спирачки', ru: 'Тормоза', en: 'Brakes' },
  suspension: { bg: 'Окачване', ru: 'Подвеска', en: 'Suspension' },
  exhaust: { bg: 'Ауспух', ru: 'Выхлоп', en: 'Exhaust' },
  cabin: { bg: 'В купето', ru: 'В салоне', en: 'In the cabin' }
};
const WHEN_LBL = {
  idle: { bg: 'На празен ход', ru: 'На холостом ходу', en: 'At idle' },
  accelerating: { bg: 'При ускорение', ru: 'При ускорении', en: 'When accelerating' },
  braking: { bg: 'При спиране', ru: 'При торможении', en: 'When braking' },
  turning: { bg: 'При завой', ru: 'При повороте', en: 'When turning' },
  coldstart: { bg: 'Студен старт', ru: 'Холодный старт', en: 'Cold start' },
  bumps: { bg: 'По неравности', ru: 'На неровностях', en: 'Over bumps' }
};

export function T(key) { const o = S[key]; if (!o) return key; const l = getLang(); return o[l] || o[String(l).split('-')[0]] || o.en || o.bg; }
export function whereLabel(v) { const o = WHERE_LBL[v]; if (!o) return v; const l = getLang(); return o[l] || o[String(l).split('-')[0]] || o.en; }
export function whenLabel(v) { const o = WHEN_LBL[v]; if (!o) return v; const l = getLang(); return o[l] || o[String(l).split('-')[0]] || o.en; }
export function urgencyLabel(u) { return u === 'urgent' ? T('urgency_urgent') : u === 'soon' ? T('urgency_soon') : T('urgency_info'); }
