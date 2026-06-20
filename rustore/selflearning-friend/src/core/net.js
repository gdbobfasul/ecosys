// net.js — fetch с таймаут БЕЗ AbortController.
//
// ЗАЩО: апът пуска CapacitorHttp (нативния HTTP на Android), за да заобикаля CORS при
// външните източници (Wikipedia, DuckDuckGo, connection.bot.token без CORS заглавие и т.н.).
// CapacitorHttp обаче НЕ поддържа AbortController/signal — подаването на signal чупеше
// заявката МОМЕНТАЛНО (затова ученето и свързването „гърмяха веднага"). Тук правим таймаута
// през Promise.race с гол fetch → работи и през нативния HTTP, и в браузъра (dev).
//
// Бележка: при таймаут самата мрежова заявка не се прекъсва (няма abort), но викащият вече
// я е изоставил — за нашите кратки GET/POST към малки JSON-и това е напълно безопасно.
export function fetchTimeout(url, opts, ms = 12000) {
  return Promise.race([
    fetch(url, opts || {}),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}
