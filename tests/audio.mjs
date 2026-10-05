/**
 * Cuarenta — pruebas del motor de audio con las muestras REALES de producción (www/audio/*.mp3).
 * Sirve www/ por HTTP: con file:// el navegador bloquea fetch y el juego usa el sintetizador.
 * Uso: node tests/audio.mjs
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const notFound = [];
let blockPiano = false;                                     // 2.ª corrida: sin piano → respaldo de banda
const server = http.createServer(async (req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (blockPiano && u.endsWith('fondo_chulla_piano.mp3')) { notFound.push(u); res.writeHead(404); res.end(); return; }
  const file = path.join(root, 'www', u === '/' ? 'index.html' : u);
  try { const b = await readFile(file); res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(b); }
  catch { notFound.push(u); res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
// Instrumenta los disparos: muestras (duración del buffer + offset) y osciladores (tipo de onda).
await page.addInitScript(() => {
  window.__starts = []; window.__osc = [];
  const o = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (t, off) { window.__starts.push({ t: t || 0, d: this.buffer ? +this.buffer.duration.toFixed(3) : 0, off: off || 0, loop: this.loop }); return o.apply(this, arguments); };
  const q = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (t) { window.__osc.push({ t: t || 0, type: this.type }); return q.apply(this, arguments); };
});
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(url);
const st = await page.evaluate(() => CU_AUDIO.preloadAudio().then(() => CU_AUDIO.status()));
check('preloadAudio(): 7 MP3 decodificados (piano y barajear incluidos)', ['bombo', 'platillo', 'latigo', 'risa', 'perro', 'piano', 'barajear'].every((n) => st.loaded.includes(n)), JSON.stringify(st.loaded));
check('barajear.mp3: salta su silencio inicial (~0.1 s)', st.leadIn.barajear > 0.05 && st.leadIn.barajear < 0.15, String(st.leadIn.barajear));
check('Piano recortado: dura ≈ 63 s', Math.abs(st.durations.piano - 63) < 0.1, String(st.durations.piano));
check('Falta vientos_pasacalle.mp3: detectado sin romper la carga', st.missing.join() === 'vientos' && st.usingSynthesizer === false, JSON.stringify(st.missing));
check('Menú informa «Mixto (7/8 muestras)»', st.mode === 'Mixto (7/8 muestras)', st.mode);
check('Silencio inicial detectado (látigo ≈ 0.21 s; resto ≈ 20 ms de retardo MP3)', Math.abs(st.leadIn.latigo - 0.21) < 0.03 && st.leadIn.bombo < 0.03, JSON.stringify(st.leadIn));

// --- la música solo arranca con «Jugar»
await page.evaluate(() => CU_AUDIO.resumeBGM());
check('resumeBGM() no arranca sin haber pulsado Jugar', await page.evaluate(() => !CU_AUDIO.isPlayingBGM()));
const row = await page.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(), s = c.width / 360; return { x: c.left + 180 * s, y: c.top + (288 + 32) * s }; });
await page.evaluate(() => { window.__starts.length = 0; window.__osc.length = 0; });
await page.mouse.click(row.x, row.y); await sleep(150);          // «🤖 Jugar contra la IA» (misma altura)
await page.mouse.click(row.x, row.y);                              // «Jugar» contra el Chulla
await sleep(1500);
const pz = await page.evaluate(() => ({ st: CU_AUDIO.status(), loops: window.__starts.filter((x) => x.loop), shuffles: window.__starts.filter((x) => x.d === CU_AUDIO.status().durations.barajear) }));
check('Al repartir suena barajear.mp3 una vez (no por carta)', pz.shuffles.length === 1 && pz.shuffles[0].off > 0.05, JSON.stringify(pz.shuffles));
check('Pulsar Jugar → fondo = piano en bucle nativo', pz.st.armed && pz.st.bgm === 'piano' && pz.loops.length === 1, JSON.stringify({ bgm: pz.st.bgm, loops: pz.loops.length }));
check('Bucle del piano: desde el fin del silencio inicial hasta 63.0 s', pz.st.pianoLoop && pz.st.pianoLoop.loop && pz.st.pianoLoop.end === 63 && pz.st.pianoLoop.start > 0.3 && pz.st.pianoLoop.start < 0.45, JSON.stringify(pz.st.pianoLoop));
check('Con piano no corre el secuenciador de banda', !pz.loops.length || !(await page.evaluate(() => window.__starts.some((x) => x.d === CU_AUDIO.status().durations.bombo))));
await page.evaluate(() => CU_AUDIO.stopBGM(0.05)); await sleep(400);
check('stopBGM() detiene y libera el piano', await page.evaluate(() => CU_AUDIO.status().bgm === 'apagado' && CU_AUDIO.status().pianoLoop === null));
await page.evaluate(() => CU_AUDIO.resumeBGM()); await sleep(300);
check('resumeBGM() (revancha/menú) vuelve a sonar el piano', await page.evaluate(() => CU_AUDIO.status().bgm === 'piano'));
await page.evaluate(() => CU_AUDIO.stopBGM(0.05)); await sleep(300);

// ---------- Ajustes: música y efectos se silencian por separado ----------
const latigoD = st.durations.latigo;
const latigo = async () => { await page.evaluate(() => { window.__starts.length = 0; CU_AUDIO.playCaida(); }); return page.evaluate((d) => window.__starts.filter((x) => x.d === d).length, latigoD); };
check('Por defecto música y efectos activos', await page.evaluate(() => CU_AUDIO.isMusicOn() && CU_AUDIO.isSfxOn()));
await page.evaluate(() => CU_AUDIO.toggleMusic()); await page.evaluate(() => CU_AUDIO.resumeBGM()); await sleep(200);
check('Música apagada: resumeBGM() no suena', await page.evaluate(() => !CU_AUDIO.isMusicOn() && CU_AUDIO.status().bgm === 'apagado'));
check('Música apagada: los efectos (látigo) siguen sonando', (await latigo()) === 1);
check('Música apagada: se guarda cu.music=0 y cu.sfx queda intacto', await page.evaluate(() => localStorage.getItem('cu.music') === '0' && localStorage.getItem('cu.sfx') === null));
await page.evaluate(() => CU_AUDIO.toggleMusic()); await sleep(300);
check('Música reactivada: vuelve el piano sin pulsar Jugar de nuevo', await page.evaluate(() => CU_AUDIO.status().bgm === 'piano'));
await page.evaluate(() => CU_AUDIO.toggleSfx()); await sleep(100);
check('Efectos apagados: el látigo no suena', (await latigo()) === 0);
check('Efectos apagados: la música sigue sonando', await page.evaluate(() => !CU_AUDIO.isSfxOn() && CU_AUDIO.isMusicOn() && CU_AUDIO.status().bgm === 'piano'));
check('Efectos apagados: se guarda cu.sfx=0', await page.evaluate(() => localStorage.getItem('cu.sfx') === '0'));
await page.evaluate(() => CU_AUDIO.toggleSfx()); await sleep(100);
check('Efectos reactivados: el látigo vuelve a sonar', (await latigo()) === 1);
await page.evaluate(() => CU_AUDIO.stopBGM(0.05)); await sleep(300);
// ajuste antiguo (cu.muted=1) → ambos apagados
await page.evaluate(() => { localStorage.removeItem('cu.music'); localStorage.removeItem('cu.sfx'); localStorage.setItem('cu.muted', '1'); });
await page.reload();
check('Migración: cu.muted=1 (versión anterior) apaga música y efectos', await page.evaluate(() => !CU_AUDIO.isMusicOn() && !CU_AUDIO.isSfxOn()));
await page.evaluate(() => localStorage.clear());

// ---------- 2.ª corrida: sin piano → banda con muestras ----------
blockPiano = true;
await page.reload();
await page.evaluate(() => CU_AUDIO.preloadAudio());
const row2 = await page.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(), s = c.width / 360; return { x: c.left + 180 * s, y: c.top + (288 + 32) * s }; });
await page.evaluate(() => { window.__starts.length = 0; window.__osc.length = 0; });
await page.mouse.click(row2.x, row2.y); await sleep(150);          // «🤖 Jugar contra la IA» (misma altura)
await page.mouse.click(row2.x, row2.y);
await sleep(4300);
const seq = await page.evaluate(() => ({ s: window.__starts.slice(), o: window.__osc.slice(), st: CU_AUDIO.status() }));
check('Sin piano: respaldo de banda con muestras', seq.st.armed && seq.st.bgm === 'muestras', JSON.stringify({ armed: seq.st.armed, bgm: seq.st.bgm }));
const D = seq.st.durations, beat = 60 / 130;
const loop = seq.s.filter((x) => x.d === D.bombo || x.d === D.platillo);
const t0 = loop[0] ? loop[0].t : 0;
const beats = [];
for (const x of loop) { const b = Math.round((x.t - t0) / beat); (beats[b] = beats[b] || []).push(x.d === D.bombo ? 'B' : 'P'); }
for (const o of seq.o.filter((o) => o.type === 'square' && o.t >= t0 - 0.001)) {        // vientos sintetizados (cuadrada)
  const k = (o.t - t0) / beat, b = Math.round(k);
  if (Math.abs(k - b) < 0.01 && b % 4 === 3) { beats[b] = beats[b] || []; if (!beats[b].includes('V')) beats[b].push('V'); }
}
const pattern = beats.slice(0, 8).map((b) => (b || []).sort().join('+')).join(' ');
check('Patrón 1:B · 2:B+P · 3:B · 4:vientos (sintetizados)', pattern === 'B B+P B V B B+P B V', pattern);
const maxErr = Math.max(...loop.map((x) => { const k = (x.t - t0) / beat; return Math.abs(k - Math.round(k)) * beat * 1000; }));
check('Reloj de audio: desvío < 1 ms a 130 BPM', maxErr < 1, maxErr.toFixed(4) + ' ms');

// --- efectos de jugada
const fx = await page.evaluate(async () => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms)), D = CU_AUDIO.status().durations;
  CU_AUDIO.stopBGM(0.05); await w(300);
  const pick = () => window.__starts.filter((x) => x.d !== 1);                 // descarta el buffer de ruido (1 s)
  window.__starts.length = 0; CU_AUDIO.playCaida(); const caida = pick();
  window.__starts.length = 0; CU_AUDIO.playCaidaYLimpia(); const cyl = pick();
  window.__starts.length = 0; CU_AUDIO.playPerro(); const perro = pick();
  await w(4500);
  const freed = CU_AUDIO.status().voices;
  for (let i = 0; i < 80; i++) CU_AUDIO.playCaida();
  const peak = CU_AUDIO.status().voices;
  const G = CU._debug.game; window.__starts.length = 0;   // con las 24 voces ocupadas
  G.p.score = 12; CU._debug.flyPoints(G.p, 8); const enJuego = pick().map((x) => x.d);
  return { D, caida, cyl, perro, freed, peak, enJuego };
});
check('playCaida() → latigo.mp3 saltando su silencio inicial', fx.caida.length === 1 && fx.caida[0].d === fx.D.latigo && fx.caida[0].off > 0.15, JSON.stringify(fx.caida));
check('playCaidaYLimpia() → látigo y risa_diablo.mp3 a +180 ms', fx.cyl.length === 2 && fx.cyl[0].d === fx.D.latigo && fx.cyl[1].d === fx.D.risa && Math.abs(fx.cyl[1].t - fx.cyl[0].t - 0.18) < 0.002, JSON.stringify(fx.cyl));
check('playPerro() → perro_ladrido.mp3', fx.perro.length === 1 && fx.perro[0].d === fx.D.perro, JSON.stringify(fx.perro));
check('onended libera todas las voces', fx.freed === 0, String(fx.freed));
check('Tope de polifonía (≤ 24 con 80 disparos)', fx.peak <= 24, String(fx.peak));
check('Con el cupo lleno, el ladrido igual suena (roba la voz más vieja)', fx.enJuego.includes(fx.D.perro), fx.enJuego.join());
const only404 = notFound.every((u) => u === '/audio/vientos_pasacalle.mp3' || u === '/audio/fondo_chulla_piano.mp3');
check('404 solo de vientos (y del piano bloqueado a propósito); sin otros errores', only404 && errors.every((e) => /404/.test(e)) && errors.length === notFound.length, JSON.stringify({ notFound, errors }));

await browser.close(); server.close();
for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : '  → ' + r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
