// Version: 1.0009
// Инициализация на Three.js: renderer, сцена, камера (first-person), небе, мъгла, светлини.
import * as THREE from 'three';

export function createEngine(container) {
  // Мобилно: НЕ задаваме powerPreference:'high-performance' — на някои телефонни
  // GPU (Mali/Adreno) това чупи/губи WebGL контекста и води до черен екран.
  // Antialias е скъп на слаби GPU — изключваме го на тъч устройства.
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const renderer = new THREE.WebGLRenderer({
    antialias: !isTouch,
    powerPreference: 'default'
  });
  // На мобилно ограничаваме pixelRatio до 1.5 — пести fillrate, по-стабилно.
  const maxPR = isTouch ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
  renderer.shadowMap.enabled = false; // мобилна производителност: без скъпи сенки
  container.appendChild(renderer.domElement);

  // ── Размер на платното (устойчиво) ───────────────────────────────────────
  // ВАЖНО (черен екран на телефона): в Capacitor WebView в момента на старта
  // `window.innerHeight` понякога е 0 или още не е установено (status bar / insets
  // се смятат по-късно). Тогава renderer.setSize(…,0) прави платно с НУЛЕВА височина →
  // 3D сцената е невидима (черно), а DOM менюто (CSS inset:0) пак се вижда → „черен
  // екран след менюто". Затова четем размера със РЕЗЕРВНИ източници и НЕ позволяваме 0,
  // а в главния цикъл се само-синхронизираме всеки кадър (виж engine.syncSize).
  let _lastW = 0, _lastH = 0;
  function readViewport() {
    const de = document.documentElement;
    const w = window.innerWidth || (de && de.clientWidth) || (window.screen && window.screen.width) || 360;
    const h = window.innerHeight || (de && de.clientHeight) || (window.screen && window.screen.height) || 640;
    return { w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
  }
  function applySize() {
    const { w, h } = readViewport();
    _lastW = w; _lastH = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, true);
  }

  // Ако WebGL контекстът се загуби (често на слаби мобилни GPU, вкл. ВРЕМЕННО при
  // старта/връщане от заден план) — показваме съобщение с бутон за рестарт.
  // КРИТИЧНО (доклад „играта не тръгва — нищо не реагира"): старият слой се показваше
  // ЗАВИНАГИ и ГЪЛТАШЕ всички докосвания, а възстановяването на контекста изобщо не се
  // слушаше. preventDefault() ПОЗВОЛЯВА автоматично възстановяване → при
  // 'webglcontextrestored' слоят се МАХА и играта продължава сама.
  let lostNote = null;
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();                 // позволи на браузъра да възстанови контекста
    console.error('[engine] WebGL контекстът беше загубен');
    if (lostNote) return;
    lostNote = document.createElement('div');
    lostNote.id = 'webgl-lost';
    lostNote.style.cssText = `position:fixed;inset:0;z-index:9998;background:#1a0808;color:#ffd2d2;
      font-family:system-ui,sans-serif;font-size:16px;display:flex;flex-direction:column;gap:14px;
      align-items:center;justify-content:center;text-align:center;padding:24px;`;
    const msg = document.createElement('div');
    msg.textContent = 'Графиката прекъсна за момент (WebGL). Изчакваме я да се върне…';
    const btn = document.createElement('button');
    btn.textContent = '↻ Рестартирай играта';
    btn.style.cssText = 'padding:12px 26px;font-size:16px;font-weight:700;border:none;border-radius:10px;background:#4fc3f7;color:#04121d;cursor:pointer';
    btn.addEventListener('click', () => { try { location.reload(); } catch (_) {} });
    lostNote.appendChild(msg); lostNote.appendChild(btn);
    document.body.appendChild(lostNote);
  }, false);
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    console.warn('[engine] WebGL контекстът се възстанови — продължаваме');
    if (lostNote) { try { lostNote.remove(); } catch (_) {} lostNote = null; }
    try { applySize(); } catch (_) {}   // главният цикъл продължава да рендира
  }, false);

  const scene = new THREE.Scene();
  // РЕЗЕРВЕН ФОН (срещу черен екран): ако небесната сфера (ShaderMaterial) НЕ се компилира на
  // някой мобилен GPU (Mali/Adreno често отказват потребителски GLSL без явна precision/версия),
  // сцената няма да е черна, а светло-синя. Атмосферата по биом го презаписва после.
  scene.background = new THREE.Color(0x16324d);

  // First-person камера
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 1200);
  camera.position.set(0, 1.7, 0); // височина на очите ~1.7m

  // Първоначален размер СЛЕД като камерата е готова (с резервните стойности).
  applySize();

  // Светлини (hemisphere + насочена "слънце")
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444433, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(60, 120, 40);
  scene.add(sun);

  window.addEventListener('resize', applySize);
  window.addEventListener('orientationchange', applySize);
  // ResizeObserver хваща случаите, в които WebView-ът установява реалния размер
  // СЛЕД старта БЕЗ да пуска 'resize' (тогава платното остава с начален/нулев размер).
  try {
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => applySize());
      ro.observe(document.documentElement);
    }
  } catch (_) { /* стар WebView без ResizeObserver → разчитаме на syncSize в цикъла */ }

  // Само-синхронизация: викана всеки кадър от главния цикъл. Евтина — пипа платното
  // САМО когато реалният размер се различава от последно приложения (вкл. когато
  // innerHeight най-после стане ненулев няколко кадъра след старта).
  function syncSize() {
    const { w, h } = readViewport();
    if (w !== _lastW || h !== _lastH) applySize();
  }

  return { renderer, scene, camera, hemi, sun, syncSize, onResize: applySize };
}

// Прилага атмосфера на терена: цвят на небето + мъгла. Извиква се при смяна на ниво.
export function applyAtmosphere(engine, { skyTop, skyBottom, fogColor, fogNear, fogFar, sunColor, sunIntensity }) {
  const { scene, sun, hemi } = engine;

  // Градиентно небе чрез голяма сфера. ВАЖНО (черен екран на телефона): по-рано ползвахме
  // потребителски ShaderMaterial (custom GLSL) — някои мобилни GPU (Mali/Adreno) отказват да
  // го компилират без явна версия/precision → цялата сцена излизаше ЧЕРНА. Затова сега градиентът
  // е ЗАПЕЧЕН във VERTEX ЦВЕТОВЕ + обикновен MeshBasicMaterial (без custom GLSL → работи навсякъде).
  if (engine._sky) { scene.remove(engine._sky); engine._sky.geometry.dispose(); engine._sky.material.dispose(); }
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const spos = skyGeo.attributes.position;
  const scol = new Float32Array(spos.count * 3);
  const cTop = new THREE.Color(skyTop), cBot = new THREE.Color(skyBottom), tmp = new THREE.Color();
  for (let i = 0; i < spos.count; i++) {
    const yN = spos.getY(i) / 900;                       // -1..1
    const h = Math.min(1, Math.max(0, (yN + 0.2) / 1.0));
    tmp.copy(cBot).lerp(cTop, h);
    scol[i * 3] = tmp.r; scol[i * 3 + 1] = tmp.g; scol[i * 3 + 2] = tmp.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(scol, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;                             // винаги рисувай небето (обгражда камерата)
  scene.add(sky);
  engine._sky = sky;

  // РЕЗЕРВЕН ФОН по биом: дори небесната сфера да не се изобрази (отказал шейдър/извън поглед),
  // фонът на кадъра е цветът на небето долу — никога черно.
  scene.background = new THREE.Color(skyBottom);

  scene.fog = new THREE.Fog(new THREE.Color(fogColor), fogNear, fogFar);
  if (sunColor) sun.color = new THREE.Color(sunColor);
  if (typeof sunIntensity === 'number') sun.intensity = sunIntensity;
  hemi.intensity = 0.7 + (sunIntensity || 0.9) * 0.2;
}
