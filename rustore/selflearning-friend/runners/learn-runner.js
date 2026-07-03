// Version: 1.0001
// learn-runner.js — СКЕЛЕ за фоново учене през @capacitor/background-runner.
//
// ВАЖНО / ЧЕСТНО ЗА ГРАНИЦИТЕ:
//   - Този рънър се изпълнява в ИЗОЛИРАН JS контекст на нативния плъгин (НЕ е WebView):
//     няма DOM, няма достъп до модулите/състоянието на приложението, няма localStorage.
//     Затова тук НЕ можем директно да пишем в същия state — само правим един кратък
//     fetch и оставяме „пинг“, който приложението при следващо отваряне може да поеме.
//   - Android/iOS дават на background-runner само КРАТКИ, РЕДКИ прозорци (минути, не
//     секунди), по преценка на ОС и пестене на батерия. Това НЕ е постоянно 24/7 учене.
//   - За истинско непрекъснато учене на заден план е нужен НАТИВЕН foreground service
//     (постоянна нотификация). Тук НЕ го имплементираме — виж store/BACKGROUND.md.
//
// Плъгинът извиква регистрираните събития. Поддържаме примитивен KV (CapacitorKV),
// който е наличен в контекста на background-runner.
//
// Това е работещ, но СЪЗНАТЕЛНО минимален скелет: прави един безплатен keyless fetch и
// записва кратък резултат + timestamp в KV под ключ 'slf.bg.lastLearned', за да го покаже
// приложението. Никакви ключове, никакви лични данни.

addEventListener('learnTick', async (resolve, reject) => {
  try {
    const topics = ['Mathematics', 'Biology', 'Chemistry', 'Physics', 'Astronomy', 'History'];
    const topic = topics[Math.floor(Date.now() / 120000) % topics.length];
    let summary = '';
    let citation = '';
    try {
      const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(topic);
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        summary = (data && data.extract ? String(data.extract) : '').slice(0, 400);
        citation = 'Wikipedia (en): ' + (data && data.title ? data.title : topic);
      }
    } catch (_) { /* офлайн → просто пропускаме този прозорец */ }

    try {
      if (typeof CapacitorKV !== 'undefined' && summary) {
        CapacitorKV.set('slf.bg.lastLearned', JSON.stringify({
          topic, summary, citation, at: Date.now()
        }));
      }
    } catch (_) { /* KV може да липсва в дев — ок */ }

    resolve();
  } catch (e) {
    reject(e);
  }
});
