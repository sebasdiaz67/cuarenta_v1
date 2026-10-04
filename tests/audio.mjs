/**
 * Cuarenta — pruebas del motor de audio por muestras (spec 004).
 * Sirve www/ por HTTP (fetch no funciona con file://) y mapea /audio/* a tests/fixtures/audio/ (WAV de prueba).
 * Uso: node tests/make-fixtures.mjs && node tests/audio.mjs
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav' };
const server = http.createServer(async (req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = u.startsWith('/audio/') ? path.join(root, 'tests/fixtures', u) : path.join(root, 'www', u === '/' ? 'index.html' : u);
  try { const b = await readFile(file); res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
// Instrumenta cada disparo de AudioBufferSourceNode: tiempo agendado + duración del buffer (identifica la muestra).
await page.addInitScript(() => {
  window.__starts = [];
  const o = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (t) { window.__starts.push({ t: t || 0, d: this.buffer ? +this.buffer.duration.toFixed(2) : 0 }); return o.apply(this, arguments); };
});
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(url);
const st = await page.evaluate(() => CU_AUDIO.preloadAudio());
check('preloadAudio(): 6/6 muestras decodificadas', st.loaded.length === 6 && st.missing.length === 0 && st.mode === 'muestras', JSON.stringify(st));
check('API pública en window.CU_AUDIO', await page.evaluate(() => ['preloadAudio', 'startBGM', 'stopBGM', 'playCaida', 'playCaidaYLimpia', 'playPerro'].every((k) => typeof CU_AUDIO[k] === 'function')));

// --- secuenciador
await page.evaluate(() => { window.__starts.length = 0; CU_AUDIO.startBGM(); });
await sleep(4200);
const seq = await page.evaluate(() => ({ s: window.__starts.slice(), st: CU_AUDIO.status() }));
const D = { bombo: 0.25, platillo: 0.3, vientos: 0.4 };
const loop = seq.s.filter((x) => [0.25, 0.3, 0.4].includes(x.d));
const t0 = loop[0] ? loop[0].t : 0, beat = 60 / 130;
const beats = [];
for (const x of loop) { const b = Math.round((x.t - t0) / beat); (beats[b] = beats[b] || []).push(x.d === D.bombo ? 'B' : x.d === D.platillo ? 'P' : 'V'); }
const pattern = beats.slice(0, 8).map((b) => (b || []).sort().join('+')).join(' ');
check('Patrón 1:B · 2:B+P · 3:B · 4:V', pattern === 'B B+P B V B B+P B V', pattern);
const maxErr = Math.max(...loop.map((x) => { const k = (x.t - t0) / beat; return Math.abs(k - Math.round(k)) * beat * 1000; }));
check('Reloj de audio: desvío < 1 ms respecto a 130 BPM', maxErr < 1, maxErr.toFixed(4) + ' ms');
check('BGM en modo muestras', seq.st.bgm === 'muestras', JSON.stringify(seq.st));

// --- limpieza de voces
await page.evaluate(() => CU_AUDIO.stopBGM(0.05));
await sleep(1500);
check('onended libera todas las voces', (await page.evaluate(() => CU_AUDIO.status().voices)) === 0);

// --- efectos de jugada
const fx = await page.evaluate(async () => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__starts.length = 0; CU_AUDIO.playCaida(); const caida = window.__starts.map((x) => x.d);
  window.__starts.length = 0; CU_AUDIO.playCaidaYLimpia(); const cyl = window.__starts.slice();
  window.__starts.length = 0; CU_AUDIO.playPerro(); const perro = window.__starts.map((x) => x.d);
  await w(1200);
  for (let i = 0; i < 80; i++) CU_AUDIO.playCaida();
  const peak = CU_AUDIO.status().voices;
  await w(800);
  // en partida: completar un perro (8 → 12) dispara el ladrido
  CU._debug.newGame(1); const G = CU._debug.game; window.__starts.length = 0;
  G.p.score = 12; CU._debug.flyPoints(G.p, 8); const enJuego = window.__starts.map((x) => x.d);
  return { caida, cyl, perro, peak, enJuego };
});
check('playCaida() → latigo.wav', fx.caida.join() === '0.15', fx.caida.join());
check('playCaidaYLimpia() → látigo y risa 180 ms después', fx.cyl.length === 2 && fx.cyl[0].d === 0.15 && fx.cyl[1].d === 0.6 && Math.abs(fx.cyl[1].t - fx.cyl[0].t - 0.18) < 0.002, JSON.stringify(fx.cyl));
check('playPerro() → perro_ladrido.wav', fx.perro.join() === '0.3', fx.perro.join());
check('Tope de polifonía (≤ 24 voces con 80 disparos)', fx.peak <= 24, String(fx.peak));
check('Completar un perro en partida ladra', fx.enJuego.includes(0.3), fx.enJuego.join());
check('Sin errores de consola', errors.length === 0, errors.join(' | '));

await browser.close(); server.close();
for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : '  → ' + r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
