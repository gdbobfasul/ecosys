// Version: 1.0021
// r3-gl.js — ОБЩ 3D двигател за приложението (споделен от „3D" (rotate3d.js) и „Хартиен 3D" (r3-paper.js)):
// минимални mat4 помощници (column-major, като WebGL), ориентация като КВАТЕРНИОН (без натрупване
// на грешка), шейдърите (текстура + плътен цвят + сянка) и компилатор на шейдър. Без библиотеки.

// ── Минимални mat4 помощници (column-major, като WebGL) ──────────────────────
export function mMul(a, b) { // връща a·b (прилага се към колонен вектор като (a·b)·v)
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
  }
  return o;
}
export function mPerspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [ f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0 ];
}
export function mTranslate(x, y, z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]; }
export function mScale(x, y, z) { return [x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]; }

// ── Ориентация като КВАТЕРНИОН [x,y,z,w] — стабилна (без натрупване на грешка) ─────────────
export function qIdent() { return [0, 0, 0, 1]; }
export function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0]/l, q[1]/l, q[2]/l, q[3]/l]; }
export function qMul(a, b) { // a ⊗ b
  return [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]
  ];
}
// Завърта q около ЕКРАННА ос (ax,ay,az) на ъгъл rad — ПРЕ-умножение (осите остават екранни).
export function qRotateWorld(q, ax, ay, az, rad) {
  const len = Math.hypot(ax, ay, az) || 1, s = Math.sin(rad/2);
  const dq = [ (ax/len)*s, (ay/len)*s, (az/len)*s, Math.cos(rad/2) ];
  return qNorm(qMul(dq, q));
}
// Кватернион → mat4 (column-major)
export function qMat(q) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const xx = x*x, yy = y*y, zz = z*z, xy = x*y, xz = x*z, yz = y*z, wx = w*x, wy = w*y, wz = w*z;
  return [
    1-2*(yy+zz), 2*(xy+wz),   2*(xz-wy),   0,
    2*(xy-wz),   1-2*(xx+zz), 2*(yz+wx),   0,
    2*(xz+wy),   2*(yz-wx),   1-2*(xx+yy), 0,
    0, 0, 0, 1
  ];
}

export const VERT = 'attribute vec3 aPos; attribute vec2 aUv; attribute float aShade;' +
  'uniform mat4 uMVP; varying vec2 vUv; varying float vShade;' +
  'void main(){ vUv = aUv; vShade = aShade; gl_Position = uMVP * vec4(aPos, 1.0); }';
// uShadow=1 → рисува силуета в черно с частична прозрачност (падаща сянка); прозрачните пиксели
// (ъглите на „телефона", PNG с прозрачност) се изхвърлят и не оставят следа.
export const FRAG = 'precision mediump float; varying vec2 vUv; varying float vShade;' +
  'uniform sampler2D uTex; uniform float uUseTex; uniform vec3 uSolid; uniform float uShadow;' +
  'void main(){ vec4 c = mix(vec4(uSolid,1.0), texture2D(uTex, vUv), uUseTex); if (c.a < 0.05) discard;' +
  ' vec3 rgb = mix(c.rgb*vShade, vec3(0.0), uShadow); float a = c.a * mix(1.0, 0.32, uShadow);' +
  ' gl_FragColor = vec4(rgb*a, a); }';

export function compile(gl, type, src) {
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
  return sh;
}
