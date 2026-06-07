// Version: 1.0193
// HLB — „3D от снимка": качената снимка става ОБЕМНА ПЛОЧКА (блок с дебелина).
// Потребителят я върти по 2 оси (хоризонтал=yaw, вертикал=pitch), за да пасне на
// мястото; запазваме ъгъла + дебелината. Скритите страни се синтезират — лицето е
// снимката, гърбът е огледален+затъмнен, ръбовете (дебелината) са в цвят, взет от
// ръба на самата снимка. Без външни библиотеки (CSS 3D + canvas за цвета).
//
// API:  HLB_IMG3D.open(imgUrl, current, onSave)
//   current = { yaw, pitch, depth } (градуси, градуси, px) или null
//   onSave  = function({ yaw, pitch, depth })   // null ако се откаже
(function () {
  'use strict';

  var STYLE_ID = 'hlb-img3d-style';
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.i3d-overlay{position:fixed;inset:0;background:rgba(10,14,20,.72);z-index:9999;display:flex;align-items:center;justify-content:center;}',
      '.i3d-modal{background:#1b232c;color:#e6edf3;border-radius:14px;padding:18px;width:min(440px,94vw);box-shadow:0 18px 50px rgba(0,0,0,.5);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;}',
      '.i3d-modal h3{margin:0 0 4px;font-size:17px;}',
      '.i3d-hint{font-size:12px;color:#9fb0c0;margin:0 0 12px;}',
      '.i3d-scene{height:260px;perspective:760px;background:radial-gradient(circle at 50% 40%,#2b3542,#161d25);border-radius:10px;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:grab;overflow:hidden;}',
      '.i3d-scene:active{cursor:grabbing;}',
      '.i3d-box{position:relative;transform-style:preserve-3d;transition:transform .04s linear;}',
      '.i3d-face{position:absolute;overflow:hidden;backface-visibility:hidden;}',
      '.i3d-face img{width:100%;height:100%;object-fit:cover;display:block;}',
      '.i3d-row{display:flex;align-items:center;gap:10px;margin-top:14px;font-size:13px;}',
      '.i3d-row input[type=range]{flex:1;}',
      '.i3d-btns{display:flex;gap:10px;margin-top:16px;justify-content:flex-end;}',
      '.i3d-btns button{padding:9px 16px;border-radius:8px;border:none;font-size:14px;font-weight:600;cursor:pointer;}',
      '.i3d-save{background:#3fae6a;color:#07210f;}',
      '.i3d-cancel{background:transparent;color:#cdd7e1;border:1px solid #44515f;}',
      '.i3d-reset{background:#2f3b48;color:#cdd7e1;}'
    ].join('');
    document.head.appendChild(s);
  }

  // Среден цвят на ръба на снимката (за страничните плоскости = „дебелината").
  function sampleEdgeColor(url, cb) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var c = document.createElement('canvas'); c.width = Math.min(64, img.naturalWidth || 64); c.height = Math.min(64, img.naturalHeight || 64);
        var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
        var d = ctx.getImageData(0, 0, c.width, c.height).data;
        var r = 0, g = 0, b = 0, n = 0;
        for (var x = 0; x < c.width; x++) { for (var yy of [0, c.height - 1]) { var p = (yy * c.width + x) * 4; r += d[p]; g += d[p + 1]; b += d[p + 2]; n++; } }
        for (var y = 0; y < c.height; y++) { for (var xx of [0, c.width - 1]) { var q = (y * c.width + xx) * 4; r += d[q]; g += d[q + 1]; b += d[q + 2]; n++; } }
        cb('rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')');
      } catch (e) { cb('#6b6258'); } // taint/cross-origin → неутрален цвят
    };
    img.onerror = function () { cb('#6b6258'); };
    img.src = url;
  }
  // Размер на лицето (вместваме снимката в ~240×190, пазейки пропорцията).
  function faceSize(url, cb) {
    var img = new Image();
    img.onload = function () { var r = (img.naturalWidth || 4) / (img.naturalHeight || 3); var W = 240, H = 190; if (r > W / H) H = Math.round(W / r); else W = Math.round(H * r); cb(W, H); };
    img.onerror = function () { cb(220, 160); };
    img.src = url;
  }
  function darker(rgb, f) {
    var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(rgb);
    if (!m) return rgb;
    return 'rgb(' + Math.round(m[1] * f) + ',' + Math.round(m[2] * f) + ',' + Math.round(m[3] * f) + ')';
  }

  function open(url, current, onSave) {
    injectStyle();
    var st = { yaw: 0, pitch: 0, depth: 24 };
    if (current) { if (isFinite(+current.yaw)) st.yaw = +current.yaw; if (isFinite(+current.pitch)) st.pitch = +current.pitch; if (isFinite(+current.depth)) st.depth = +current.depth; }

    faceSize(url, function (W, H) {
      sampleEdgeColor(url, function (edge) {
        var ov = document.createElement('div'); ov.className = 'i3d-overlay';
        ov.innerHTML =
          '<div class="i3d-modal">' +
            '<h3>🧊 ' + (window.HLB_I18N ? HLB_I18N.t('rooms.item_3d') : 'Завърти като 3D') + '</h3>' +
            '<p class="i3d-hint">Влачи с мишка/пръст за завъртане (хоризонтал + вертикал). Плъзгачът мени дебелината.</p>' +
            '<div class="i3d-scene"><div class="i3d-box"></div></div>' +
            '<div class="i3d-row">Дебелина <input type="range" class="i3d-depth" min="2" max="80" step="1" value="' + st.depth + '"> <span class="i3d-depthv">' + st.depth + 'px</span></div>' +
            '<div class="i3d-btns">' +
              '<button type="button" class="i3d-reset">Нулирай</button>' +
              '<button type="button" class="i3d-cancel">Отказ</button>' +
              '<button type="button" class="i3d-save">Запази</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(ov);

        var box = ov.querySelector('.i3d-box');
        var side = darker(edge, 0.78), topc = darker(edge, 0.92), botc = darker(edge, 0.6);
        // 6 плоскости: лице(снимка), гръб(огледален+тъмен), ляво/дясно/горе/долу(дебелина).
        function buildFaces() {
          var d = st.depth;
          box.style.width = W + 'px'; box.style.height = H + 'px';
          box.innerHTML =
            face(W, H, 'translateZ(' + (d / 2) + 'px)', '<img src="' + url + '" alt="">') +                                   // лице
            face(W, H, 'rotateY(180deg) translateZ(' + (d / 2) + 'px)', '<img src="' + url + '" style="transform:scaleX(-1);filter:brightness(.45)">') + // гръб
            face(d, H, 'rotateY(90deg) translateZ(' + (W - d / 2) + 'px)', '', side) +                                         // дясно
            face(d, H, 'rotateY(-90deg) translateZ(' + (d / 2) + 'px)', '', side) +                                            // ляво
            face(W, d, 'rotateX(90deg) translateZ(' + (d / 2) + 'px)', '', topc) +                                            // горе
            face(W, d, 'rotateX(-90deg) translateZ(' + (H - d / 2) + 'px)', '', botc);                                        // долу
          apply();
        }
        function face(w, h, tr, inner, bg) {
          var styleExtra = bg ? ('background:' + bg + ';') : '';
          // центрираме плоскостта в кутията
          var left = (W - w) / 2, top = (H - h) / 2;
          return '<div class="i3d-face" style="width:' + w + 'px;height:' + h + 'px;left:' + left + 'px;top:' + top + 'px;transform:' + tr + ';' + styleExtra + '">' + (inner || '') + '</div>';
        }
        function apply() { box.style.transform = 'rotateX(' + st.pitch + 'deg) rotateY(' + st.yaw + 'deg)'; }

        // влачене → въртене
        var scene = ov.querySelector('.i3d-scene'), dragging = false, lx = 0, ly = 0;
        scene.addEventListener('pointerdown', function (e) { dragging = true; lx = e.clientX; ly = e.clientY; scene.setPointerCapture(e.pointerId); });
        scene.addEventListener('pointermove', function (e) {
          if (!dragging) return;
          st.yaw += (e.clientX - lx) * 0.6; lx = e.clientX;
          st.pitch -= (e.clientY - ly) * 0.6; ly = e.clientY;
          st.pitch = Math.max(-89, Math.min(89, st.pitch));
          apply();
        });
        scene.addEventListener('pointerup', function () { dragging = false; });
        scene.addEventListener('pointercancel', function () { dragging = false; });

        var depth = ov.querySelector('.i3d-depth'), depthv = ov.querySelector('.i3d-depthv');
        depth.addEventListener('input', function () { st.depth = +depth.value; depthv.textContent = st.depth + 'px'; buildFaces(); });

        function close() { ov.remove(); }
        ov.querySelector('.i3d-reset').onclick = function () { st.yaw = 0; st.pitch = 0; st.depth = 24; depth.value = 24; depthv.textContent = '24px'; buildFaces(); };
        ov.querySelector('.i3d-cancel').onclick = function () { close(); if (onSave) onSave(null); };
        ov.querySelector('.i3d-save').onclick = function () { close(); if (onSave) onSave({ yaw: Math.round(st.yaw), pitch: Math.round(st.pitch), depth: Math.round(st.depth) }); };
        ov.addEventListener('click', function (e) { if (e.target === ov) { close(); if (onSave) onSave(null); } });

        buildFaces();
      });
    });
  }

  window.HLB_IMG3D = { open: open };
})();
