// Version: 1.0001
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

  // Ако WebGL контекстът се загуби (често на слаби мобилни GPU) — показваме
  // видимо съобщение вместо мълчалив черен екран.
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.error('[engine] WebGL контекстът беше загубен');
    const note = document.createElement('div');
    note.id = 'webgl-lost';
    note.style.cssText = `position:fixed;inset:0;z-index:9998;background:#1a0808;color:#ffd2d2;
      font-family:system-ui,sans-serif;font-size:16px;display:flex;align-items:center;
      justify-content:center;text-align:center;padding:24px;`;
    note.textContent = 'WebGL контекстът се загуби (графиката рестартира). Затворете и отворете приложението отново.';
    document.body.appendChild(note);
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

  // Градиентно небе чрез голяма сфера с шейдър-материал по vertex Y.
  if (engine._sky) { scene.remove(engine._sky); engine._sky.geometry.dispose(); engine._sky.material.dispose(); }
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(skyTop) },
      bottom: { value: new THREE.Color(skyBottom) }
    },
    vertexShader: `
      varying vec3 vPos;
      void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 bottom;
      void main(){
        float h = clamp((normalize(vPos).y + 0.2) / 1.0, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottom, top, h), 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
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
