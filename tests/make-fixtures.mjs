/**
 * Genera WAV de PRUEBA (PCM 16 bit mono 22 050 Hz) para tests/audio.mjs. NO son el audio del juego:
 * los samples reales (grabaciones de banda de pueblo) van en www/audio/ — ver www/audio/LEEME.md.
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados.
 */
import { writeFileSync } from 'node:fs';
const SR = 22050, dir = new URL('./fixtures/audio/', import.meta.url);
function wav(name, dur, fn) {
  const n = Math.floor(SR * dur), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, fn(i / SR))) * 32000), 44 + i * 2);
  writeFileSync(new URL(name + '.wav', dir), b);
}
const env = (t, d) => Math.exp(-t / d), rnd = () => Math.random() * 2 - 1;
wav('bombo', 0.25, (t) => Math.sin(2 * Math.PI * (60 + 80 * env(t, 0.03)) * t) * env(t, 0.08));
wav('platillo', 0.3, (t) => rnd() * env(t, 0.07) * 0.6);
wav('vientos_pasacalle', 0.4, (t) => [220, 277, 330].reduce((a, f) => a + Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.2, 0) * Math.min(1, t * 40) * env(t, 0.3));
wav('latigo', 0.15, (t) => rnd() * env(t, 0.02));
wav('risa_diablo', 0.6, (t) => Math.sin(2 * Math.PI * 160 * t) * Math.max(0, Math.sin(2 * Math.PI * 7 * t)) * 0.7);
wav('perro_ladrido', 0.3, (t) => Math.sign(Math.sin(2 * Math.PI * (500 - 600 * t) * t)) * env(t, 0.06) * 0.6);
console.log('fixtures OK');
