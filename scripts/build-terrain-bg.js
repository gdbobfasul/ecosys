// Изважда painterly engine-а от patch/*.html в преизползваеми модули — ПО ЕДИН ЗА ВСЯКА ИГРА,
// защото двата фона се различават (храсти/сцена). Всеки модул излага window.startTerrainBg,
// който пуска СВОЯТА сцена на подадения canvas.
//   patch/DUEL_1280x960.html          → terrain-duel.js  (сцена 1, гора 1280×960)
//   patch/FIGHT_ON_PLACE_1920x2560.html → terrain-fight.js (сцена 2, път 1920×2560)
// Пускане:  node scripts/build-terrain-bg.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const JOBS = [
  { src: 'patch/DUEL_1280x960.html',            scene: 1, seed: 20260606, out: 'public/portals/games/terrain-duel.js' },
  { src: 'patch/FIGHT_ON_PLACE_1920x2560.html', scene: 2, seed: 7,        out: 'public/portals/games/terrain-fight.js' },
];

function build(job) {
  const html = fs.readFileSync(path.join(ROOT, job.src), 'utf8');
  const m = html.match(/<script>\s*([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Няма <script> в ' + job.src);
  let eng = m[1];

  // Махни runner-а/exports (всичко от най-ранния от тези маркери):
  const markers = ['\n(function(){', '\nconst cv=document.getElementById', '\nif(typeof module'];
  let cut = -1;
  for (const mk of markers) {
    const i = eng.indexOf(mk);
    if (i >= 0 && (cut === -1 || i < cut)) cut = i;
  }
  if (cut >= 0) eng = eng.slice(0, cut);

  const N = job.scene;
  const starter = `
// ── стартер: пуска СЦЕНА ${N} на подадения canvas ──
function startTerrainBg(canvas){
  var ctx = canvas.getContext('2d');
  var S = buildScene${N}(canvas.width, canvas.height, ${job.seed});
  var start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  (function loop(now){ renderScene${N}(ctx, S, now - start); requestAnimationFrame(loop); })(start);
  return S;
}
if (typeof window !== 'undefined') window.startTerrainBg = startTerrainBg;
`;

  const out =
`// AUTO-GENERATED от scripts/build-terrain-bg.js (източник: ${job.src}).
// НЕ редактирай ръчно — промени патча/скрипта и пусни: node scripts/build-terrain-bg.js
(function(){
${eng}
${starter}
})();
`;
  fs.writeFileSync(path.join(ROOT, job.out), out);
  console.log('✓', job.out, '—', Math.round(out.length / 1024), 'KB (сцена ' + N + ')');
}

JOBS.forEach(build);
