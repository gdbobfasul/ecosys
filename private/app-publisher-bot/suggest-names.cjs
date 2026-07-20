#!/usr/bin/env node
// suggest-names.cjs — за ВСЯКО (рисково) приложение проверява по ~10 кандидат-имена през
// name-check робота (магазини + марки + домейни + ниши) и пише ЧЕТИМ доклад, подреден по риск,
// за да избереш. НЕ преименува нищо. Резултат: name-checks/NAME-SUGGESTIONS.md (+ по файл на ап).
const fs = require('fs');
const path = require('path');
const { nameCheck } = require('./lib/name-check.cjs');
const { pool } = require('./lib/util.cjs');

const OUT_DIR = path.join(__dirname, 'name-checks');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 10 кандидата на приложение (отличителни/измислени → минават clearance по-лесно от речникови думи).
const CANDIDATES = {
  'autoreply-bot':      ['ReplyNook', 'Replyra', 'AutoNudge', 'QuickQuip', 'ReplyGeni', 'Answerly', 'ReplyBee', 'SnapReply', 'EchoDesk Reply', 'ReplyPocket'],
  'baby-monitor':       ['BabyGaze', 'CribPeek', 'NestlingCam', 'LullaWatch', 'TinyGuard', 'BabbleCam', 'CradleEye', 'PeekaBaby', 'SnugMonitor', 'DreamWatch Baby'],
  'business-faq-bot':   ['AskDesk FAQ', 'FAQ Genie', 'AnswerDesk', 'HelpNook', 'QueryDesk', 'FaqPilot', 'ReplyDesk', 'AskFlow', 'FaqNest', 'InfoNook'],
  'camera-watch':       ['MotionSentry Cam', 'GuardLens', 'WatchLens', 'MoveAlert Cam', 'VigilCam', 'MotionHawk', 'LensGuard', 'StirCam', 'WardenCam', 'SentryLens'],
  'dodge-master':       ['Dodgestorm', 'Dodgefall', 'Bullet Whirl', 'EvadeArena', 'Dashdodge', 'Dodgeloop', 'ZigZag Rush', 'Dodge Vortex', 'Nimblefall', 'Swipe Dodger'],
  'duel':               ['Ring Clash Heroes', 'Duelforge', 'Arena Fists', 'Clashbout', 'Fistfall Arena', 'Duelstorm', 'RingRumble', 'Champion Clash', 'Bout Legends', 'Heroes Duel'],
  'fps-hunter':         ['Wildshot Range', 'Huntline 3D', 'Rangeshot', 'Trophy Range', 'Shotwild', 'Field Hunter 3D', 'Rangehawk', 'Wildscope', 'Huntstorm', 'Wild Range 3D'],
  'hmm':                ['Trio Clash Arena', 'Trio Battle', 'Triad Arena', 'Trioforge', 'Three Fists', 'Trioclash', 'Trine Battle', 'Trio Rumble', 'TriadFight', 'Squad Trio'],
  'monitor-bot':        ['FeedPinger', 'FeedHawk', 'WatchWire', 'FeedNudge', 'PingFeed', 'FeedSignal', 'Feedwatch', 'AlertWire', 'FeedPulse', 'Watchping'],
  'price-watch-bot':    ['RateBeacon', 'PriceHawk', 'RatePing', 'CoinBeacon', 'PricePulse', 'RateHawk', 'Ratewatch', 'TickAlert', 'PriceNudge', 'RateSignal'],
  'routine-bot':        ['DayNest Routine', 'DayGroove', 'MorningKick', 'RoutineFlow', 'DayCadence', 'RiseRoutine', 'DayNudge', 'FlowDay', 'RoutineNest', 'DayPilot Routine'],
  'plane-shooter':      ['Aero Barrage', 'Skyfire Squad', 'Wingstorm Run', 'Bullet Skies', 'Sky Strafe', 'Jetfire Alley', 'Warbird Rush', 'Aces Barrage', 'Propfire', 'Skybound Guns'],
  'rustam':             ['Cucumber Rush', 'Cuke Dash', 'Garden Rush', 'Pickle Panic', 'Cucumber Dash', 'Mole Escape', 'Veggie Rush', 'Cuke Rush', 'Garden Dodger', 'Mole & Cukes'],
  'selflearning-friend':['Learnling', 'Braincub', 'TeachPal', 'Mindsprig', 'Studybud', 'Learnkin', 'Braincharm', 'Mindly Pal', 'Learnly Pal', 'Mindkin'],
  'titans-fight':       ['Titan Fist Arena', 'Titanbout', 'Godfist Arena', 'Titan Rumble', 'Fist of Titans', 'Titanclash', 'Titan Legends', 'Colossus Fists', 'Titanforge', 'Warfist Arena'],
};

const RISK_ORDER = { 'НИСЪК': 0, 'СРЕДЕН': 1, 'ВИСОК': 2, 'ГРЕШКА': 3 };
const RISK_ICON = { 'НИСЪК': '🟢', 'СРЕДЕН': '🟡', 'ВИСОК': '🔴', 'ГРЕШКА': '⚪' };

async function checkOne(name) {
  try {
    const r = await nameCheck(name);
    return { name, risk: r.risk || 'ГРЕШКА', why: (r.riskWhy || []).join('; ') };
  } catch (e) {
    return { name, risk: 'ГРЕШКА', why: String((e && e.message) || e) };
  }
}

(async () => {
  // Per-app: `node suggest-names.cjs rustam duel` → само тези; без аргументи → всички.
  const argApps = process.argv.slice(2).map((a) => a.replace(/^huawei\//, ''));
  const apps = argApps.length ? argApps.filter((a) => CANDIDATES[a]) : Object.keys(CANDIDATES);
  if (!apps.length) { console.log('Няма кандидати за: ' + argApps.join(', ')); return; }
  const master = ['# Предложения за имена — анализ (name-check робот)', '',
    'За всяко приложение: 10 кандидата, проверени срещу App Store, Huawei AppGallery, търговски марки (TMview: ЕС/CN/RU/BG/US) и домейни. Подредени 🟢 НИСЪК → 🔴 ВИСОК. Първото 🟢 е препоръката.', ''];

  for (const app of apps) {
    const names = CANDIDATES[app];
    process.stdout.write(`\n### ${app} (${names.length} имена)\n`);
    // Concurrency 4 — балансира скорост срещу rate-limit на външните бази.
    const results = await pool(names, 4, checkOne);
    results.sort((a, b) => (RISK_ORDER[a.risk] - RISK_ORDER[b.risk]) || a.name.localeCompare(b.name));
    for (const r of results) process.stdout.write(`  ${RISK_ICON[r.risk]} ${r.risk.padEnd(7)} ${r.name}${r.why ? '  — ' + r.why : ''}\n`);

    const rec = results.find((r) => r.risk === 'НИСЪК') || results[0];
    const sec = [`## ${app}`, '', `**Препоръка: „${rec.name}" ${RISK_ICON[rec.risk]}**`, '',
      '| Име | Риск | Бележка |', '|---|---|---|'];
    for (const r of results) sec.push(`| ${r.name} | ${RISK_ICON[r.risk]} ${r.risk} | ${r.why || '—'} |`);
    sec.push('');
    master.push(...sec);
    // Пиши инкрементално, за да може да се чете и по време на работа.
    fs.writeFileSync(path.join(OUT_DIR, 'NAME-SUGGESTIONS.md'), master.join('\n'), 'utf8');
    // Копие във publish/ на приложението — за да се разглежда по всяко време.
    const pub = path.join(__dirname, '..', '..', 'huawei', app, 'publish');
    if (fs.existsSync(pub)) {
      const perApp = [`# Предложения за търговски имена — ${app}`, '',
        '(name-check робот: App Store + Huawei AppGallery + марки TMview + домейни; 🟢 НИСЪК препоръчано)', '',
        ...sec.slice(2)];
      fs.writeFileSync(path.join(pub, 'NAME-SUGGESTIONS.md'), perApp.join('\n'), 'utf8');
    }
  }
  console.log('\n\nГотово → name-checks/NAME-SUGGESTIONS.md');
})();
