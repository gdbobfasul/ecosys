// Version: 1.0021
// rule-engine.js — ядрото: правило/ключова дума → отговор, иначе предаване на човек.
// (i18n само за резервния текст по подразбиране; самата логика е on-device.)
// ИЗЦЯЛО on-device. БЕЗ LLM, БЕЗ мрежа. Просто, детерминирано, обяснимо.
//
// Формат на Q&A запис (виж storage.js):
//   { id, label, keywords: string[], answer, enabled: boolean, hits: number }
//
// Алгоритъм (1.0021 — търсене с ТОЛЕРАНС):
//   1. Нормализираме входа (малки букви, без диакритика/пунктуация/арабски огласовки).
//   2. За всеки активен запис оценяваме всяка ключова дума/фраза:
//      а) точно вхождение на фразата във входа → тежест 2 × брой думи;
//      б) иначе „меко" съвпадение дума по дума: всяка дума от фразата трябва да се
//         намери сред думите на входа — еднаква, синоним (таблица SYN), обща основа
//         (префикс ≥ 4 букви: open/opening, цена/цените) или печатна грешка
//         (разстояние на Левенщайн ≤ 1 при ≥ 5 букви, ≤ 2 при ≥ 8) → тежест 1 × брой думи.
//   3. Печели записът с най-висок резултат (> 0), при равенство — по-предният в списъка.
//      Иначе → предаване на човек (fallback текст).
import { t } from './i18n.js';

// Групи синоними (многоезични, нормализирани). Дума от една група „равнява" всяка друга
// от същата група — така „cost" удря правило с ключова дума „price", „стойност" — „цена".
const SYN_GROUPS = [
  ['hours', 'open', 'opening', 'opened', 'close', 'closed', 'closing', 'schedule', 'timing', 'timings', 'работно', 'отворено', 'отворени', 'затворено', 'часове', 'график', 'часы', 'открыто', 'закрыто', 'режим', 'працюєте', 'відкрито', 'зачинено', 'години', 'offnungszeiten', 'geoffnet', 'offen', 'geschlossen', 'horaires', 'ouvert', 'ferme', 'horario', 'horarios', 'abierto', 'cerrado', 'orari', 'orario', 'aperto', 'chiuso', 'aberto', 'fechado'],
  ['price', 'prices', 'cost', 'costs', 'fee', 'fees', 'rate', 'rates', 'pricing', 'цена', 'цени', 'цената', 'цените', 'струва', 'стойност', 'ценоразпис', 'тарифа', 'цены', 'стоимость', 'прайс', 'ціна', 'ціни', 'вартість', 'preis', 'preise', 'kosten', 'kostet', 'prix', 'tarif', 'tarifs', 'cout', 'precio', 'precios', 'coste', 'costo', 'prezzo', 'prezzi', 'preco', 'precos', 'valor'],
  ['address', 'location', 'located', 'where', 'directions', 'адрес', 'адреса', 'локация', 'къде', 'местоположение', 'где', 'адресу', 'де', 'adresse', 'standort', 'wo', 'ou', 'direccion', 'ubicacion', 'donde', 'indirizzo', 'dove', 'endereco', 'morada', 'onde'],
  ['delivery', 'deliver', 'delivered', 'shipping', 'ship', 'shipped', 'courier', 'доставка', 'доставяте', 'доставите', 'куриер', 'пратка', 'доставляете', 'курьер', 'посылка', 'lieferung', 'liefern', 'versand', 'livraison', 'livrer', 'livrez', 'expedition', 'envio', 'envios', 'entrega', 'entregan', 'consegna', 'spedizione', 'entregas', 'frete'],
  ['return', 'returns', 'refund', 'refunds', 'exchange', 'replace', 'връщане', 'върна', 'замяна', 'рекламация', 'възстановяване', 'возврат', 'вернуть', 'обмен', 'повернення', 'повернути', 'ruckgabe', 'zuruckgeben', 'umtausch', 'erstattung', 'retour', 'retourner', 'remboursement', 'devolver', 'devolucion', 'reembolso', 'reso', 'resi', 'rimborso', 'devolucao'],
  ['payment', 'pay', 'paying', 'paid', 'card', 'cash', 'invoice', 'плащане', 'платя', 'плащам', 'карта', 'брой', 'оплата', 'оплатить', 'наличные', 'zahlung', 'bezahlen', 'zahlen', 'paiement', 'payer', 'pago', 'pagar', 'pagamento', 'pagare'],
  ['contact', 'phone', 'telephone', 'call', 'email', 'mail', 'reach', 'контакт', 'телефон', 'обадя', 'имейл', 'поща', 'номер', 'контакты', 'позвонить', 'почта', 'зв’язатися', 'kontakt', 'anrufen', 'telefon', 'contacter', 'telephone', 'appeler', 'contacto', 'contactar', 'telefono', 'llamar', 'correo', 'contatto', 'contatti', 'chiamare', 'contato', 'ligar'],
  ['warranty', 'guarantee', 'broken', 'defect', 'defective', 'repair', 'гаранция', 'счупи', 'дефект', 'ремонт', 'гарантия', 'сломался', 'брак', 'гарантія', 'garantie', 'defekt', 'reparatur', 'kaputt', 'reparation', 'garantia', 'reparacion', 'garanzia', 'riparazione', 'reparacao'],
  ['book', 'booking', 'appointment', 'reserve', 'reservation', 'schedule', 'запазя', 'запиша', 'записване', 'резервация', 'резервирам', 'час', 'записаться', 'запись', 'бронь', 'termin', 'reservieren', 'reservierung', 'buchen', 'rendez', 'reserver', 'cita', 'reservar', 'reserva', 'appuntamento', 'prenotare', 'prenotazione', 'marcar', 'marcacao', 'agendar'],
  ['discount', 'discounts', 'promotion', 'promo', 'sale', 'coupon', 'voucher', 'offer', 'cheaper', 'отстъпка', 'отстъпки', 'промоция', 'намаление', 'купон', 'ваучер', 'промокод', 'скидка', 'скидки', 'акция', 'знижка', 'rabatt', 'aktion', 'gutschein', 'angebot', 'remise', 'reduction', 'soldes', 'descuento', 'descuentos', 'promocion', 'rebajas', 'oferta', 'sconto', 'sconti', 'promozione', 'desconto', 'descontos', 'promocao'],
  ['parking', 'park', 'паркинг', 'паркирам', 'парковка', 'стоянка', 'паркування', 'parken', 'parkplatz', 'garer', 'stationnement', 'aparcamiento', 'aparcar', 'estacionamiento', 'estacionar', 'parcheggio', 'parcheggiare', 'estacionamento'],
  ['stock', 'available', 'availability', 'order', 'наличност', 'налично', 'поръчка', 'поръчката', 'наличие', 'заказ', 'наявність', 'замовлення', 'lager', 'verfugbar', 'bestellung', 'disponible', 'commande', 'pedido', 'disponibilidad', 'disponibile', 'ordine', 'estoque', 'disponivel'],
  ['sunday', 'saturday', 'weekend', 'holiday', 'holidays', 'неделя', 'събота', 'уикенд', 'празник', 'празници', 'воскресенье', 'суббота', 'выходные', 'праздник', 'неділя', 'субота', 'вихідні', 'свято', 'sonntag', 'samstag', 'wochenende', 'feiertag', 'dimanche', 'samedi', 'ferie', 'domingo', 'sabado', 'festivo', 'domenica', 'sabato', 'festivi', 'feriado'],
  ['hello', 'hi', 'hey', 'thanks', 'thank', 'здравей', 'здравейте', 'благодаря', 'мерси', 'здравствуйте', 'привет', 'спасибо', 'вітаю', 'дякую', 'hallo', 'danke', 'bonjour', 'salut', 'merci', 'hola', 'gracias', 'ciao', 'grazie', 'ola', 'obrigado', 'obrigada']
];
const SYN = new Map();
SYN_GROUPS.forEach((g, gi) => g.forEach((w) => { if (!SYN.has(w)) SYN.set(w, gi); }));

// Премахва диакритика/огласовки и сваля до сравним вид.
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // махаме комбиниращи диакритични знаци
    .replace(/[ً-ٰٟ]/g, '') // арабски огласовки (ташкил)
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي') // арабски варианти на букви
    .replace(/ё/g, 'е') // ё → е
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // пунктуация → интервал
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(norm) {
  return norm ? norm.split(' ').filter(Boolean) : [];
}

// Разстояние на Левенщайн (къси думи; с праг за ранно спиране).
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let left = i, best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, left + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev[j - 1] = left; left = v; if (v < best) best = v;
    }
    prev[b.length] = left;
    if (best > max) return max + 1;
  }
  return prev[b.length];
}

// „Меко" равенство на две думи: еднакви / синоними / обща основа / печатна грешка.
export function tokenMatch(a, b) {
  if (a === b) return true;
  const ga = SYN.get(a), gb = SYN.get(b);
  if (ga != null && ga === gb) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 4 && (a.startsWith(b) || b.startsWith(a))) return true; // обща основа
  if (minLen >= 5) {
    const tol = minLen >= 8 ? 2 : 1;
    return lev(a, b, tol) <= tol;
  }
  return false;
}

// Оценява един запис спрямо нормализиран вход. Връща { score, matched }.
export function scoreEntry(entry, normInput) {
  let score = 0;
  const matched = [];
  const inToks = tokens(normInput);
  for (const raw of entry.keywords || []) {
    const kw = normalize(raw);
    if (!kw) continue;
    if (normInput.includes(kw)) {
      // Точно вхождение: по-дългите фрази тежат повече (брой думи във фразата).
      score += kw.split(' ').length * 2;
      matched.push(raw);
      continue;
    }
    // Меко съвпадение дума по дума (всички думи от фразата трябва да се намерят).
    const kwToks = tokens(kw);
    if (!kwToks.length || !inToks.length) continue;
    const all = kwToks.every((kt) => inToks.some((it) => tokenMatch(kt, it)));
    if (all) { score += kwToks.length; matched.push(raw); }
  }
  return { score, matched };
}

// Главна функция: намира най-доброто съвпадение.
// Връща обект:
//   { type: 'answer', entry, answer, matched }   при намерено правило
//   { type: 'handoff', answer }                  когато нищо не съвпада (към човек)
export function match(kb, input, fallbackText) {
  const normInput = normalize(input);
  let best = null;

  for (const entry of kb || []) {
    if (entry.enabled === false) continue;
    const { score, matched } = scoreEntry(entry, normInput);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { entry, score, matched };
    }
  }

  if (best) {
    return {
      type: 'answer',
      entry: best.entry,
      answer: best.entry.answer,
      matched: best.matched,
      score: best.score
    };
  }
  return {
    type: 'handoff',
    answer: fallbackText || t('fallback_default')
  };
}
