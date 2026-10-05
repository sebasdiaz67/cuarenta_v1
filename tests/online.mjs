/**
 * Cuarenta — prueba de extremo a extremo del modo online: dos navegadores reales contra server.js.
 * Crea la mesa en A, se une B con el código, juegan una partida completa y se verifica la coherencia.
 * Uso: node tests/online.mjs   (SHOTS=carpeta para capturas)
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados.
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { server, rooms } = require('../server.js');
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;
const shots = process.env.SHOTS || '';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--autoplay-policy=no-user-gesture-required'] });
async function phone() {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); page.errors = [];
  page.missing = []; page.on('response', (r) => { if (r.status() === 404) page.missing.push(new URL(r.url()).pathname); });
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto(url); await page.waitForTimeout(300);
  page.tap = async (x, y) => { const q = await page.evaluate(([x, y]) => { const c = document.getElementById('game').getBoundingClientRect(), s = c.width / 360; return { x: c.left + x * s, y: c.top + y * s }; }, [x, y]); await page.mouse.click(q.x, q.y); };
  return page;
}
const A = await phone(), B = await phone();

// ---------- lobby ----------
await A.tap(180, 358); await B.tap(180, 358); await sleep(200);
await A.click('#lb-create');
await A.waitForSelector('#lb-status .code', { timeout: 8000 });
const code = await A.textContent('#lb-status .code');
check('Crear Mesa muestra un código de 4 dígitos', /^\d{4}$/.test(code), code);
if (shots) await A.screenshot({ path: path.join(shots, 'online_A_mesa.png') });
await B.fill('#lb-code', '12'); await B.click('#lb-join'); await sleep(100);
check('Código incompleto → aviso sin llamar al servidor', /4 dígitos/.test(await B.textContent('#lb-status')));
await B.fill('#lb-code', code); await B.click('#lb-join');
await Promise.all([A, B].map((p) => p.waitForFunction(() => CU._debug.game && CU._debug.game.online, null, { timeout: 8000 })));
check('Unirse a Mesa → ambos entran a la partida y el submenú se cierra', await A.evaluate(() => document.getElementById('lobby').hidden) && await B.evaluate(() => document.getElementById('lobby').hidden));
check('La música arranca al empezar la partida online', await A.evaluate(() => CU_AUDIO.isPlayingBGM()) && await B.evaluate(() => CU_AUDIO.isPlayingBGM()));

// ---------- partida completa ----------
const fast = { ANIM_PLAY: 0.05, ANIM_DEAL: 0.03, ANIM_CAPTURE: 0.05, DEAL_GAP: 0.005, HIGHLIGHT: 0.05, COUNT_STEP: 0.003, CARTON_HOLD: 0.15 };
await Promise.all([A, B].map((p) => p.evaluate((f) => Object.assign(CU.CFG, f), fast)));
const inspect = (p) => p.evaluate(() => {
  const d = CU._debug, G = d.game;
  const idle = ['TURNO_JUGADOR', 'TURNO_RIVAL_RED', 'ESPERA_RED'].includes(d.state) && !d.netQueue.length && !G.play;
  const total = G.deck.length + G.table.length + G.p.hand.length + G.a.hand.length + G.p.pile.length + G.a.pile.length;
  return { s: d.state, idle, total, hidden: G.a.hand.every((c) => c.id === '?' && !c.rank), you: G.p.score, rival: G.a.score, rivalPlayed: G.seen.length };
});
let plays = 0, badTotal = [], leaks = 0, sawRivalWait = false, shotTaken = false;
const t0 = Date.now();
while (Date.now() - t0 < 240000) {
  const [a, b] = await Promise.all([inspect(A), inspect(B)]);
  for (const [n, x] of [['A', a], ['B', b]]) {
    if (x.idle && x.total !== 40) badTotal.push(`${n}:${x.total}`);
    if (!x.hidden) leaks++;
    if (x.s === 'TURNO_RIVAL_RED') sawRivalWait = true;
  }
  if (a.s === 'JUEGO_TERMINADO' && b.s === 'JUEGO_TERMINADO') break;
  for (const [p, x] of [[A, a], [B, b]]) {
    if (x.s !== 'TURNO_JUGADOR') continue;
    await p.evaluate(() => { const G = CU._debug.game; const h = G.p.hand; CU._debug.humanPlay(h[Math.floor(Math.random() * h.length)]); });
    plays++;
    if (shots && !shotTaken && plays === 7) { shotTaken = true; await sleep(250); await Promise.all([A.screenshot({ path: path.join(shots, 'online_A.png') }), B.screenshot({ path: path.join(shots, 'online_B.png') })]); }
  }
  await sleep(20);
}
const [fa, fb] = await Promise.all([A, B].map((p) => p.evaluate(() => { const G = CU._debug.game; return { s: CU._debug.state, you: G.p.score, rival: G.a.score, won: G.winner === G.p, lost: G.winner === G.a }; })));
check('La partida online llega a JUEGO_TERMINADO en ambos teléfonos', fa.s === 'JUEGO_TERMINADO' && fb.s === 'JUEGO_TERMINADO', JSON.stringify({ fa, fb, plays }));
check('Marcadores espejo (A.tú = B.rival) y un solo ganador', fa.you === fb.rival && fa.rival === fb.you && fa.won !== fb.won && fa.won === !fa.lost, JSON.stringify({ fa, fb }));
check('Alguien llegó a 40', Math.max(fa.you, fa.rival) >= 40, `${fa.you}-${fa.rival}`);
check('Siempre 40 cartas en cada cliente en reposo', badTotal.length === 0, badTotal.slice(0, 5).join(','));
check('La mano del rival nunca llega al cliente (solo reversos)', leaks === 0, String(leaks));
check('Estado TURNO_RIVAL_RED mientras juega el amigo', sawRivalWait);
check(`Se jugaron ${plays} cartas por la red`, plays >= 20, String(plays));
if (shots) await A.screenshot({ path: path.join(shots, 'online_final_A.png') });

// ---------- abandono ----------
await sleep(1000);                                                     // el botón «Menú» aparece a los 0.8 s
await A.tap(180, 496); await B.tap(180, 496); await sleep(300);       // «Menú» en ambos
check('Menú tras la partida online cierra la mesa en el servidor', rooms.size === 0, String(rooms.size));
await A.tap(180, 358); await B.tap(180, 358); await sleep(150);
await A.click('#lb-create'); await A.waitForSelector('#lb-status .code');
const code2 = await A.textContent('#lb-status .code');
await B.fill('#lb-code', code2); await B.click('#lb-join');
await A.waitForFunction(() => CU._debug.game && CU._debug.game.online && CU._debug.state !== 'LOBBY');
await sleep(500);
await B.close();
await A.waitForFunction(() => CU._debug.state === 'JUEGO_TERMINADO', null, { timeout: 8000 }).catch(() => {});
const ab = await A.evaluate(() => ({ s: CU._debug.state, msg: CU._debug.game && CU._debug.game.abandoned }));
check('Si el amigo cierra la app → «Tu amigo salió de la mesa»', ab.s === 'JUEGO_TERMINADO' && /salió/.test(ab.msg || ''), JSON.stringify(ab));
if (shots) await A.screenshot({ path: path.join(shots, 'online_abandono.png') });
await sleep(200);
check('La mesa abandonada se borra del servidor', rooms.size === 0, String(rooms.size));
const missing = [...A.missing, ...B.missing];
const only404 = (p) => p.errors.every((e) => /404/.test(e)) && p.errors.length === p.missing.length;
check('Sin errores de consola salvo el 404 conocido de vientos_pasacalle.mp3', only404(A) && only404(B) && missing.every((m) => m.endsWith('vientos_pasacalle.mp3')), JSON.stringify({ missing, errors: [...A.errors, ...B.errors] }));

await browser.close(); server.close();
for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : '  → ' + r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
