/**
 * Cuarenta: El Juicio de las Leyendas — pruebas de reglas y partida completa (spec 001).
 * Requisitos: npm i -D playwright (o CHROMIUM_PATH=/ruta/chromium). Uso: node tests/smoke.mjs
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados.
 */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = pathToFileURL(path.join(root, 'www', 'index.html')).href;
const shots = process.env.SHOTS || '';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };

await page.goto(url); await wait(400);
check('Autoría y título', (await page.title()) === 'Cuarenta: El Juicio de las Leyendas'
  && (await page.getAttribute('meta[name="author"]', 'content')) === 'Byron Sebastián Rosero Díaz');
await shot('01_menu');

// ---------- Reglas (puras) ----------
const rules = await page.evaluate(() => {
  const R = CU.Rules, deck = R.makeDeck();
  const card = (rank, suit = 'oro') => deck.find((c) => c.rank.id === rank && c.suit.id === suit);
  const ids = (cap) => cap ? cap.taken.map((c) => c.rank.id).sort().join(',') : null;
  const out = {};
  out.deck = { n: deck.length, ranks: [...new Set(deck.map((c) => c.rank.id))].join('') };
  out.igual = ids(R.findCapture(card('5'), [card('5', 'espada'), card('2')]));
  out.escalera = ids(R.findCapture(card('4'), [card('4', 'espada'), card('5'), card('6'), card('K')]));
  out.escaleraCorta = ids(R.findCapture(card('6'), [card('6', 'espada'), card('J')]));       // falta el 7: no sigue a la Sota
  out.escaleraFiguras = ids(R.findCapture(card('7'), [card('7', 'espada'), card('J'), card('Q'), card('K')]));
  out.suma = ids(R.findCapture(card('7'), [card('3'), card('4'), card('K')]));
  out.sumaEscalera = ids(R.findCapture(card('7'), [card('3'), card('4'), card('J'), card('Q')]));
  out.figuraNoSuma = R.findCapture(card('K'), [card('3'), card('7')]);
  out.nada = R.findCapture(card('2'), [card('5'), card('K')]);
  const last = card('6', 'basilica');
  const c1 = R.findCapture(card('6'), [card('3'), last], last);
  out.caida = { caida: c1.caida, limpia: c1.limpia };
  out.caidaYLimpia = R.playPoints(R.findCapture(card('6'), [last], last), 10).points;
  out.limpiaSola = R.playPoints(R.findCapture(card('5'), [card('5', 'espada')], null), 10).points;
  out.regla38 = R.playPoints(R.findCapture(card('6'), [last], last), 38);
  out.ronda = R.checkRonda([card('3'), card('3', 'espada'), card('3', 'basilica'), card('K'), card('A')], 10);
  out.ronda38 = R.checkRonda([card('3'), card('3', 'espada'), card('3', 'basilica'), card('K'), card('A')], 38);
  out.cuatro = R.checkRonda([card('3'), card('3', 'espada'), card('3', 'basilica'), card('3', 'campana'), card('A')], 0);
  out.carton = [19, 20, 21, 22, 23, 24, 30].map((n) => R.cartonPoints(n));
  out.markers = [0, 2, 8, 10, 24, 38, 40].map((n) => { const m = CU.Draw.markers(n); return m.perros + '/' + m.tantos; }).join(' ');
  out.cartonReparto = R.carton(24, 16, 10, 10, true);
  out.empate = R.carton(20, 20, 10, 10, false);
  out.carton38 = R.carton(24, 16, 38, 10, true);
  return out;
});
check('Baraja de 40: As–7, Sota, Caballo, Rey', rules.deck.n === 40 && rules.deck.ranks === 'A234567JQK', JSON.stringify(rules.deck));
check('Marcador: perros (10) y tantos (2)', rules.markers === '0/0 0/1 0/4 1/0 2/2 3/4 4/0', rules.markers);
check('Levanta carta igual', rules.igual === '5');
check('Escalera ascendente desde la carta igual', rules.escalera === '4,5,6', rules.escalera);
check('La escalera se corta si falta una carta', rules.escaleraCorta === '6', rules.escaleraCorta);
check('Escalera 7 → Sota → Caballo → Rey', rules.escaleraFiguras === '7,J,K,Q', rules.escaleraFiguras);
check('Suma 3 + 4 = 7', rules.suma === '3,4', rules.suma);
check('Suma y luego escalera (3+4=7, Sota, Caballo)', rules.sumaEscalera === '3,4,J,Q', rules.sumaEscalera);
check('Las figuras no suman', rules.figuraNoSuma === null);
check('Sin coincidencia la carta queda en la mesa', rules.nada === null);
check('Caída: levantar la carta recién jugada por el rival', rules.caida.caida === true && rules.caida.limpia === false);
check('Caída y limpia = 4 puntos', rules.caidaYLimpia === 4, String(rules.caidaYLimpia));
check('Limpia sola = 2 puntos', rules.limpiaSola === 2, String(rules.limpiaSola));
check('Regla de 38: solo vale la caída', rules.regla38.points === 2 && rules.regla38.limpiaAnulada === true, JSON.stringify(rules.regla38));
check('Ronda: tres iguales +2', rules.ronda.type === 'ronda' && rules.ronda.points === 2);
check('Ronda no vale con 38', rules.ronda38.points === 0);
check('Cuatro iguales gana la chica', rules.cuatro.type === 'cuatro');
check('Cartón: 20→6, 21/22→8, 23/24→10, 30→16', JSON.stringify(rules.carton) === JSON.stringify([0, 6, 8, 8, 10, 10, 16]), JSON.stringify(rules.carton));
check('Cartón al que tiene más cartas', rules.cartonReparto.a === 10 && rules.cartonReparto.b === 0);
check('Empate 20–20: dos por dar al que repartió', rules.empate.b === 2 && rules.empate.a === 0 && rules.empate.tie);
check('Cartón no suma con 38', rules.carton38.a === 0);

// ---------- Partida real desde el menú ----------
const tapRow = async (i) => page.evaluate((i) => { const c = document.getElementById('game').getBoundingClientRect(); const s = c.width / 360;
  return { x: c.left + 180 * s, y: c.top + (258 + i * 82 + 37) * s }; }, i);
let p = await tapRow(3); await page.mouse.click(p.x, p.y); await wait(300);
check('Menú → reparto contra Cantuña y el Diablo', (await page.evaluate(() => CU._debug.game && CU._debug.game.rival.id)) === 'cantuna');
await wait(2200);
const st = await page.evaluate(() => { const G = CU._debug.game;
  return { s: CU._debug.state, n: G.p.hand.length + G.a.hand.length + G.table.length + G.p.pile.length + G.a.pile.length + (G.play && !G.table.includes(G.play.card) && !G.p.pile.includes(G.play.card) && !G.a.pile.includes(G.play.card) ? 1 : 0), deck: G.deck.length, p: G.p.hand.length }; });
check('REPARTIR_CARTAS: 5 + 5 cartas repartidas (30 en el mazo)', (st.n === 10 && st.deck === 30) || st.s === 'JUEGO_TERMINADO', JSON.stringify(st));
await shot('02_mesa');

// Jugada por toque: seleccionar y confirmar
await page.evaluate(async () => { while (CU._debug.state !== 'TURNO_JUGADOR' && CU._debug.state !== 'JUEGO_TERMINADO') await new Promise((r) => setTimeout(r, 50)); });
if ((await page.evaluate(() => CU._debug.state)) === 'TURNO_JUGADOR') {
  const pos = await page.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(), s = c.width / 360, k = CU._debug.game.p.hand[0];
    return { x: c.left + k.x * s, y: c.top + k.y * s }; });
  await page.mouse.click(pos.x, pos.y); await wait(150);
  await shot('03_seleccion');
  check('Primer toque selecciona la carta', await page.evaluate(() => !!CU._debug.game.selected));
  await page.mouse.click(pos.x, pos.y + 16 * 0); await wait(80);
  const after = await page.evaluate(() => ({ s: CU._debug.state, n: CU._debug.game.p.hand.length }));
  check('Segundo toque juega (VALIDAR_JUGADA)', after.s === 'VALIDAR_JUGADA' && after.n === 4, JSON.stringify(after));
}

// ---------- spec 002: música, lanzamiento flotante y diablillos ----------
const v2 = await page.evaluate(async () => {
  const d = CU._debug, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { api: typeof CU.Audio.playBGM === 'function' && typeof CU.Audio.stopBGM === 'function', bgmOn: CU.Audio.isPlayingBGM() };
  while (d.state !== 'TURNO_JUGADOR' && d.state !== 'JUEGO_TERMINADO') await sleep(20);
  if (d.state === 'TURNO_JUGADOR') {
    const c = d.game.p.hand[0]; const x0 = c.x, y0 = c.y;
    d.playCard(d.game.p, c); await sleep(90);
    const a = c.anim, k = a ? a.t / a.dur : 0;
    out.flight = { dur: a ? a.dur : null, moved: Math.hypot(c.x - x0, c.y - y0) > 5, rot: c.rot,
      linear: !!a && Math.abs(c.x - (a.fromX + (c.targetX - a.fromX) * k)) < 0.5 && Math.abs(c.y - (a.fromY + (c.targetY - a.fromY) * k)) < 0.5 };
  }
  await sleep(1500);
  out.imps = CU.Draw.Imps.count();
  CU.Draw.Imps.burst(180, 300, 200, 200);                 // fuerza el tope del pool
  out.poolCap = CU.Draw.Imps.count();
  out.cache = CU.Draw.cacheSize();
  CU.Audio.stopBGM(); out.bgmOff = !CU.Audio.isPlayingBGM(); CU.Audio.playBGM();
  return out;
});
check('BGM: playBGM()/stopBGM() públicos y arranca al tocar el menú', v2.api && v2.bgmOn && v2.bgmOff, JSON.stringify(v2));
check('Lanzamiento flotante: 0.2 s, interpola y se inclina en vuelo', v2.flight && v2.flight.dur === 0.2 && v2.flight.moved && Math.abs(v2.flight.rot) > 0.01, JSON.stringify(v2.flight));
check('Lerp lineal hacia (targetX, targetY)', v2.flight && v2.flight.linear, JSON.stringify(v2.flight));
check('Diablillos ambientales en el atrio de Cantuña', v2.imps > 0, String(v2.imps));
check('Pool de partículas acotado (≤ 80)', v2.poolCap <= 80 && v2.poolCap > 60, String(v2.poolCap));
check('Caché de sprites acotada', v2.cache > 0 && v2.cache < 120, String(v2.cache));
await shot('05_diablillos');

// El resto de la partida en automático: el jugador usa la misma IA (estilo del Gallo)
await page.evaluate(() => Object.assign(CU.CFG, { ANIM_PLAY: 0.04, ANIM_CAPTURE: 0.04, AI_THINK: [0.02, 0.03], DEAL_GAP: 0.004, HIGHLIGHT: 0.04, COUNT_STEP: 0.002, CARTON_HOLD: 0.1 }));
const sim = await page.evaluate(async () => {
  const d = CU._debug; const states = new Set(); let maxCards = 0, minCards = 99, iter = 0, scoreSeq = [];
  const t0 = performance.now();
  while (d.state !== 'JUEGO_TERMINADO' && performance.now() - t0 < 240000) {
    const G = d.game; states.add(d.state);
    const total = G.deck.length + G.table.length + G.p.hand.length + G.a.hand.length + G.p.pile.length + G.a.pile.length + (G.play && !G.table.includes(G.play.card) && !G.p.pile.includes(G.play.card) && !G.a.pile.includes(G.play.card) ? 1 : 0);
    if (G.play && G.play.card && !G.table.includes(G.play.card) && !G.p.pile.includes(G.play.card) && !G.a.pile.includes(G.play.card) && G.deck.includes(G.play.card)) maxCards = 99;
    maxCards = Math.max(maxCards, total); minCards = Math.min(minCards, total);
    if (d.state === 'TURNO_JUGADOR') {
      const c = d.aiChoose(CU.RIVALS[1], G.p.hand, G.table, { last: G.lastBy === G.a ? G.last : null, myScore: G.p.score, myHand: G.p.hand, seen: G.seen, memory: false, oppHandSize: G.a.hand.length });
      d.playCard(G.p, c);
    }
    if (++iter % 20 === 0) scoreSeq.push(G.p.score + '-' + G.a.score);
    await new Promise((r) => setTimeout(r, 15));
  }
  const G = d.game;
  return { final: d.state, p: G.p.score, a: G.a.score, decks: G.deckNo, states: [...states], maxCards, minCards, winner: G.winner && G.winner.name };
});
check('Partida completa hasta JUEGO_TERMINADO', sim.final === 'JUEGO_TERMINADO', JSON.stringify(sim));
check('Alguien llegó a 40', Math.max(sim.p, sim.a) >= 40 || sim.winner, `${sim.p}-${sim.a}`);
check('Siempre 40 cartas en juego (sin perder ni duplicar)', sim.maxCards === 40 && sim.minCards === 40, `${sim.minCards}..${sim.maxCards}`);
check('Se recorrieron los estados', ['REPARTIR_CARTAS', 'TURNO_JUGADOR', 'TURNO_IA', 'VALIDAR_JUGADA'].every((s) => sim.states.includes(s)), sim.states.join(','));
check('Hubo conteo de cartón (más de un mazo o fin por cartón)', sim.states.includes('CONTEO_CARTON') || sim.decks >= 1, String(sim.decks));
await wait(1000); await shot('04_final');
// ---------- rendimiento: costo de render con CPU 4× más lenta (gama baja) y pool lleno ----------
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const perf = await page.evaluate(async () => {
  const d = CU._debug; d.newGame(3); await new Promise((r) => setTimeout(r, 1500));
  CU.Draw.Imps.burst(180, 300, 40, 60);
  const ts = []; for (let i = 0; i < 120; i++) { const t = performance.now(); d.render(); ts.push(performance.now() - t); }
  ts.sort((a, b) => a - b);
  return { avg: ts.reduce((a, b) => a + b, 0) / ts.length, p95: ts[Math.floor(ts.length * 0.95)], particles: CU.Draw.Imps.count() };
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
check('Render < 16.7 ms con CPU ×4 y partículas al tope', perf.p95 < 16.7, JSON.stringify(perf));
check('Sin errores de consola', errors.length === 0, errors.join(' | '));
await browser.close();
for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : '  → ' + r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
console.log('Render CPU×4:', JSON.stringify(perf));
console.log('Partida simulada:', JSON.stringify({ marcador: `${sim.p}-${sim.a}`, mazos: sim.decks, ganador: sim.winner }));
process.exit(failed ? 1 : 0);
