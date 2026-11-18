/* Генерира двете мелодии за известия като WAV: emergency (тревожна) и problem (по-мека).
 * Еднакви за сървъра и клиентските приложения. */
'use strict';
const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'web', 'sounds');
fs.mkdirSync(OUT, { recursive: true });
const RATE = 22050;

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, samples[i] | 0)), 44 + i * 2);
  return buf;
}
const tone = (arr, freq, ms, vol = 0.5, shape = 'flat') => {
  const n = Math.round(RATE * ms / 1000);
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (shape === 'flat') env = i < 80 ? i / 80 : (i > n - 80 ? (n - i) / 80 : 1);
    else if (shape === 'soft') env = Math.sin(Math.PI * i / n);           // плавно нарастване/спад
    arr.push(Math.sin(2 * Math.PI * freq * i / RATE) * 32767 * vol * env);
  }
};
const silence = (arr, ms) => { for (let i = 0, n = RATE * ms / 1000; i < n; i++) arr.push(0); };

// СПЕШЕН: бързи тревожни двойни бипове, високо, 3 пъти
const emerg = [];
for (let k = 0; k < 3; k++) { tone(emerg, 1046, 120, 0.6); silence(emerg, 60); tone(emerg, 1318, 120, 0.6); silence(emerg, 180); }
fs.writeFileSync(path.join(OUT, 'emergency.wav'), wav(emerg));

// ПРОБЛЕМ: спокоен възходящ двутон, 2 пъти
const prob = [];
for (let k = 0; k < 2; k++) { tone(prob, 587, 200, 0.4, 'soft'); tone(prob, 784, 260, 0.4, 'soft'); silence(prob, 160); }
fs.writeFileSync(path.join(OUT, 'problem.wav'), wav(prob));

console.log('Готови: web/sounds/emergency.wav, web/sounds/problem.wav');
