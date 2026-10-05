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
const au = await page.evaluate(() => CU_AUDIO.preloadAudio());
check('Audio con file://: «Sintetizado», usingSynthesizer y sin fetch', au.mode === 'Sintetizado' && au.usingSynthesizer === true && au.loaded.length === 0, JSON.stringify(au));
check('La música no arranca antes de pulsar Jugar', await page.evaluate(() => !CU_AUDIO.isPlayingBGM() && !CU_AUDIO.status().armed));

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
  // --- caída (Punto 6): bug del As propio + escalera sobre el 2 del rival
  const asP = card('A'), dosIA = card('2', 'espada'), asJ = card('A', 'basilica'), asIA = card('A', 'campana');
  const bug = R.findCapture(asJ, [asP, dosIA], dosIA);
  out.caidaBug = { taken: bug.taken.map((c) => c.rank.id).join(','), caida: bug.caida, limpia: bug.limpia, pts: R.playPoints(bug, 10).points };
  out.caidaValida = R.findCapture(asJ, [asIA], asIA).caida;
  out.caidaYEscalera = (() => { const c = R.findCapture(asJ, [asIA, dosIA], asIA); return c.caida && c.taken.length === 2; })();
  out.caidaPrefiereUltima = (() => { const c = R.findCapture(asJ, [asP, asIA], asIA); return c.taken[0] === asIA && c.caida; })();
  out.sumaNoEsCaida = R.findCapture(card('3'), [asP, dosIA], dosIA).caida;
  out.sinUltimaNoHayCaida = R.findCapture(asJ, [asIA], null).caida;
  out.checkCaida = [R.checkCaida(asJ, asIA, asIA), R.checkCaida(asJ, asP, dosIA), R.checkCaida(asJ, asIA, null)].join();
  // --- auditoría de nomenclatura y suma (spec 001, Puntos 2-4)
  out.porPalo = CU.SUITS.map((su) => deck.filter((c) => c.suit.id === su.id).map((c) => c.rank.id).join('')).join('|');
  out.labels = CU.RANKS.map((r) => r.label).join('');
  out.nominal = CU.RANKS.filter((r) => r.figure).map((r) => r.id + r.nominal).join(',');
  out.sin89 = !deck.some((c) => ['8', '9'].includes(c.rank.id) || c.rank.nominal === 8 || c.rank.nominal === 9);
  out.ordenEscalera = [...CU.RANKS].sort((a, b) => a.order - b.order).map((r) => r.id).join(',');
  out.kSoloK = [ids(R.findCapture(card('K'), [card('K', 'espada'), card('5')])), R.findCapture(card('K'), [card('5'), card('7')])];
  out.bestSumConFigura = R.bestSum([card('3'), card('4'), card('J')], 7).map((c) => c.rank.id).sort().join(',');
  out.validaSumaConJ = R.validateSuma(card('7'), [card('3'), card('4'), card('J')]);
  out.validaSuma34 = R.validateSuma(card('7'), [card('3'), card('4')]);
  out.figuraNoSumaFiguras = [R.validateSuma(card('K'), [card('J'), card('Q')]), R.findCapture(card('K'), [card('J'), card('Q', 'espada')])];
  out.sumaPuraSinJ = ids(R.findCapture(card('7'), [card('3'), card('4'), card('J')]));      // manual §5C (por defecto)
  const esc = CU.RULES.ESCALERA_TRAS_SUMA; CU.RULES.ESCALERA_TRAS_SUMA = true;              // variante regional
  out.sumaLuegoEscalera = ids(R.findCapture(card('7'), [card('3'), card('4'), card('J')]));
  out.sumaEscaleraVariante = ids(R.findCapture(card('7'), [card('3'), card('4'), card('J'), card('Q')]));
  CU.RULES.ESCALERA_TRAS_SUMA = esc;
  // --- manual §9, §10, §15B, §16
  const tres = [card('3'), card('3', 'espada'), card('3', 'basilica'), card('K'), card('A')];
  out.ronda30 = [R.checkRonda(tres, 30).points, R.checkRonda(tres, 31).points, R.checkRonda(tres, 32).points].join();
  out.dosPorDarSig = [R.carton(20, 20, 10, 10, true), R.carton(18, 18, 10, 10, false)].map((x) => `${x.a}/${x.b}/${x.dosPorDar}`).join(' ');
  out.falla = R.carton(22, 0, 10, 10, true);
  out.falla38 = R.carton(22, 0, 38, 10, true);
  const st = [0, 0], seq = [true, true, true].map((c) => R.caidaStreak(st, 0, c));
  out.racha = { tres: seq.join(), cuarta: R.caidaStreak(st, 0, true) };
  const st2 = [3, 0]; R.caidaStreak(st2, 1, true); out.rachaCortada = st2.join();
  const st3 = [3, 0]; R.caidaStreak(st3, 0, false); out.rachaSinCaida = st3.join();
  out.zap = [R.zapateria(8), R.zapateria(10)].join();
  out.defaults = { escalera: CU.RULES.ESCALERA_TRAS_SUMA, sobrantes: CU.RULES.SOBRANTES_AL_ULTIMO, chicas: CU.RULES.CHICAS_PARA_GANAR };
  out.markers = [0, 2, 8, 10, 24, 38, 40].map((n) => { const m = CU.Draw.markers(n); return m.perros + '/' + m.tantos; }).join(' ');
  out.cartonReparto = R.carton(24, 16, 10, 10, true);
  out.empate = R.carton(20, 20, 10, 10, false);
  out.carton38 = R.carton(24, 16, 38, 10, true);
  return out;
});
check('Baraja de 40: As–7, Sota, Caballo, Rey', rules.deck.n === 40 && rules.deck.ranks === 'A234567JQK', JSON.stringify(rules.deck));
check('Marcador: perros (10) y tantos (2)', rules.markers === '0/0 0/1 0/4 1/0 2/2 3/4 4/0', rules.markers);
check('Mazo: 10 cartas por brillo, exactamente A–7, J, Q, K', rules.porPalo === 'A234567JQK|A234567JQK|A234567JQK|A234567JQK', rules.porPalo);
check('Figuras impresas como J, Q, K (no S, C, R)', rules.labels === 'A234567JQK', rules.labels);
check('Numeración nominal J=10, Q=11, K=12; sin 8 ni 9', rules.nominal === 'J10,Q11,K12' && rules.sin89, rules.nominal);
check('Escalera en orden 1…7, J, Q, K', rules.ordenEscalera === 'A,2,3,4,5,6,7,J,Q,K', rules.ordenEscalera);
check('K solo captura K por emparejamiento', rules.kSoloK[0] === 'K' && rules.kSoloK[1] === null, JSON.stringify(rules.kSoloK));
check('bestSum() ignora figuras aunque se las pasen', rules.bestSumConFigura === '3,4', rules.bestSumConFigura);
check('validateSuma(): 7 = 3+4 sí; 3+4+J no', rules.validaSuma34 === true && rules.validaSumaConJ === false);
check('Las figuras no suman entre sí (K ≠ J+Q)', rules.figuraNoSumaFiguras[0] === false && rules.figuraNoSumaFiguras[1] === null);
check('§5C: tras una suma NO se sigue la escalera (7 sobre 3, 4, J → 3+4)', rules.sumaPuraSinJ === '3,4', rules.sumaPuraSinJ);
check('Variante ESCALERA_TRAS_SUMA: la J entra por escalera, no por suma', rules.sumaLuegoEscalera === '3,4,J' && rules.sumaEscaleraVariante === '3,4,J,Q', rules.sumaLuegoEscalera + ' | ' + rules.sumaEscaleraVariante);
check('§9: con más de 30 puntos no hay ronda (30 sí, 31 y 32 no)', rules.ronda30 === '2,0,0', rules.ronda30);
check('§10B: «dos por dar» a quien reparte a continuación (también con empates bajo 20)', rules.dosPorDarSig === '0/2/b 2/0/a', rules.dosPorDarSig);
check('§10C: «dos por falla» se suma al cartón (22 vs 0 → 8 + 2)', rules.falla.a === 10 && rules.falla.falla === 'b' && rules.falla38.a === 0, JSON.stringify(rules.falla));
check('§15B: la 4.ª caída seguida gana la chica', rules.racha.tres === 'false,false,false' && rules.racha.cuarta === true, JSON.stringify(rules.racha));
check('§15B: la racha se corta si el rival hace caída o si no haces caída', rules.rachaCortada === '0,1' && rules.rachaSinCaida === '0,0', rules.rachaCortada + ' | ' + rules.rachaSinCaida);
check('§16: zapatería con menos de 10 puntos', rules.zap === 'true,false', rules.zap);
check('Valores por defecto según el manual (sin escalera tras suma, sobrantes retiradas, 2 de 3 chicas)', !rules.defaults.escalera && !rules.defaults.sobrantes && rules.defaults.chicas === 2, JSON.stringify(rules.defaults));
check('BUG caída: A propio + escalera sobre el 2 del rival NO es caída (solo limpia, 2 pts)', rules.caidaBug.taken === 'A,2' && rules.caidaBug.caida === false && rules.caidaBug.limpia && rules.caidaBug.pts === 2, JSON.stringify(rules.caidaBug));
check('Caída válida: igual a la carta que el rival acaba de lanzar', rules.caidaValida === true);
check('Caída + escalera desde la carta del rival sigue siendo caída', rules.caidaYEscalera === true);
check('Con dos iguales en la mesa se empareja la del rival (para la caída)', rules.caidaPrefiereUltima === true);
check('Levantar por suma nunca es caída', rules.sumaNoEsCaida === false);
check('Sin carta previa del rival (null) no hay caída', rules.sinUltimaNoHayCaida === false);
check('checkCaida(): misma carta sí · otra carta no · null no', rules.checkCaida === 'true,false,false', rules.checkCaida);
check('Levanta carta igual', rules.igual === '5');
check('Escalera ascendente desde la carta igual', rules.escalera === '4,5,6', rules.escalera);
check('La escalera se corta si falta una carta', rules.escaleraCorta === '6', rules.escaleraCorta);
check('Escalera 7 → Sota → Caballo → Rey', rules.escaleraFiguras === '7,J,K,Q', rules.escaleraFiguras);
check('Suma 3 + 4 = 7', rules.suma === '3,4', rules.suma);
check('Suma sin escalera: 7 sobre 3, 4, J, Q → 3+4', rules.sumaEscalera === '3,4', rules.sumaEscalera);
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
check('Empate 20–20: dos por dar a quien reparte a continuación', rules.empate.a === 2 && rules.empate.b === 0 && rules.empate.tie, JSON.stringify(rules.empate));
check('Cartón no suma con 38', rules.carton38.a === 0);

// ---------- Partida real desde el menú ----------
const tapRow = async (i) => page.evaluate((i) => { const c = document.getElementById('game').getBoundingClientRect(); const s = c.width / 360;
  return { x: c.left + 180 * s, y: c.top + (258 + i * 82 + 37) * s }; }, i);
{ const c = await page.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.12 }; });
  await page.mouse.click(c.x, c.y); await wait(150); }                       // toque fuera de «Jugar» (en el título)
check('Un toque en el menú que no es «Jugar» no inicia la música', await page.evaluate(() => !CU_AUDIO.isPlayingBGM()));
const tapAt = async (x, y) => { const q = await page.evaluate(([x, y]) => { const c = document.getElementById('game').getBoundingClientRect(); const s = c.width / 360; return { x: c.left + x * s, y: c.top + y * s }; }, [x, y]); await page.mouse.click(q.x, q.y); };
await tapAt(180, 290); await wait(200);                                   // «🤖 Jugar contra la IA»
check('Menú principal → «Jugar contra la IA» abre la lista de leyendas', await page.evaluate(() => CU._debug.state === 'MENU_IA' && !CU_AUDIO.isPlayingBGM()));
await tapAt(52, 240); await wait(150);                                    // «‹ Volver»
check('«‹ Volver» regresa al menú principal', await page.evaluate(() => CU._debug.state === 'MENU'));
await tapAt(180, 358); await wait(200);                                   // «🤝 Jugar con un Amigo (Online)»
const lob = await page.evaluate(() => ({ s: CU._debug.state, open: !document.getElementById('lobby').hidden, dis: document.getElementById('lb-create').disabled, txt: document.getElementById('lb-status').textContent }));
check('Online con file:// → submenú abierto, botones deshabilitados y aviso del servidor', lob.s === 'LOBBY' && lob.open && lob.dis && /servidor/.test(lob.txt), JSON.stringify(lob));
await page.click('#lb-back'); await wait(150);
check('Sin red no se intentó cargar Socket.io (sin errores) y vuelve al menú', await page.evaluate(() => CU._debug.state === 'MENU' && !window.io && document.getElementById('lobby').hidden));
await tapAt(180, 290); await wait(200);
let p = await tapRow(3); await page.mouse.click(p.x, p.y); await wait(300);
check('Pulsar «Jugar» (elegir leyenda) arma e inicia la música', await page.evaluate(() => CU_AUDIO.isPlayingBGM() && CU_AUDIO.status().armed));
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

// ---------- caída en partida real: escenario reportado, por VALIDAR_JUGADA ----------
const integ = await page.evaluate(async () => {
  const d = CU._debug, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  d.newGame(1);
  while (d.state !== 'TURNO_JUGADOR' && d.state !== 'TURNO_IA') await sleep(20);
  const G = d.game, deck = CU.Rules.makeDeck(), card = (r, s) => deck.find((c) => c.rank.id === r && c.suit.id === s);
  const pos = (c, x, y) => Object.assign(c, { x, y, faceUp: true });
  const asP = pos(card('A', 'oro'), 150, 300), dosIA = pos(card('2', 'espada'), 210, 300), asJ = pos(card('A', 'basilica'), 180, 538);
  G.table = [asP, dosIA]; G.lastPlayedCard = dosIA; G.lastPlayedBy = G.a;        // la IA acaba de lanzar el 2
  G.p.hand = [asJ]; G.p.score = 10; G.a.score = 10; d.setState('TURNO_JUGADOR');
  const avisos = []; const orig = CU_AUDIO.playCaida; let latigo = 0; CU_AUDIO.playCaida = () => { latigo++; };
  d.playCard(G.p, asJ);
  while (d.state === 'VALIDAR_JUGADA') { if (G.play && G.play.pts) avisos.push(G.play.pts); await sleep(10); }
  CU_AUDIO.playCaida = orig;
  const pts = avisos[0] || {};
  const r1 = { caida: pts.caida, limpia: pts.limpia, p: G.p.score, a: G.a.score, latigo, ultima: G.lastPlayedCard };
  d.newGame(3);                                          // partida limpia para la simulación siguiente
  while (d.state !== 'TURNO_JUGADOR' && d.state !== 'TURNO_IA') await sleep(20);
  return { r1 };
});
check('Partida: As sobre [A propio, 2 de la IA] → +2 limpia, sin caída ni látigo; IA no suma', integ.r1.caida === false && integ.r1.limpia === true && integ.r1.p === 12 && integ.r1.a === 10 && integ.r1.latigo === 0 && integ.r1.ultima === null, JSON.stringify(integ.r1));

// El resto de la partida en automático: el jugador usa la misma IA (estilo del Gallo)
await page.evaluate(() => Object.assign(CU.CFG, { ANIM_PLAY: 0.04, ANIM_CAPTURE: 0.04, AI_THINK: [0.02, 0.03], DEAL_GAP: 0.004, HIGHLIGHT: 0.04, COUNT_STEP: 0.002, CARTON_HOLD: 0.1 }));
const sim = await page.evaluate(async () => {
  const d = CU._debug; const states = new Set(); let maxCards = 0, minCards = 99, iter = 0, scoreSeq = [];
  const t0 = performance.now();
  while (d.state !== 'JUEGO_TERMINADO' && performance.now() - t0 < 240000) {
    const G = d.game; states.add(d.state);
    if (d.state === 'REPARTIR_CARTAS' && G.lastPlayedCard !== null) window.__caidaPendiente = (window.__caidaPendiente || 0) + 1;
    const total = G.deck.length + G.table.length + G.p.hand.length + G.a.hand.length + G.p.pile.length + G.a.pile.length + (G.play && !G.table.includes(G.play.card) && !G.p.pile.includes(G.play.card) && !G.a.pile.includes(G.play.card) ? 1 : 0);
    if (G.play && G.play.card && !G.table.includes(G.play.card) && !G.p.pile.includes(G.play.card) && !G.a.pile.includes(G.play.card) && G.deck.includes(G.play.card)) maxCards = 99;
    maxCards = Math.max(maxCards, total); minCards = Math.min(minCards, total);
    if (d.state === 'TURNO_JUGADOR') {
      const c = d.aiChoose(CU.RIVALS[1], G.p.hand, G.table, { last: G.lastPlayedBy === G.a ? G.lastPlayedCard : null, myScore: G.p.score, myHand: G.p.hand, seen: G.seen, memory: false, oppHandSize: G.a.hand.length });
      d.playCard(G.p, c);
    }
    if (++iter % 20 === 0) scoreSeq.push(G.p.score + '-' + G.a.score);
    await new Promise((r) => setTimeout(r, 15));
  }
  const G = d.game;
  return { caidaPendiente: window.__caidaPendiente || 0, final: d.state, p: G.p.score, a: G.a.score, decks: G.deckNo, states: [...states], maxCards, minCards, winner: G.winner && G.winner.name };
});
check('Partida completa hasta JUEGO_TERMINADO', sim.final === 'JUEGO_TERMINADO', JSON.stringify(sim));
check('Cada reparto empieza sin caída pendiente (lastPlayedCard = null)', sim.caidaPendiente === 0, String(sim.caidaPendiente));
check('Alguien llegó a 40', Math.max(sim.p, sim.a) >= 40 || sim.winner, `${sim.p}-${sim.a}`);
check('Siempre 40 cartas en juego (sin perder ni duplicar)', sim.maxCards === 40 && sim.minCards === 40, `${sim.minCards}..${sim.maxCards}`);
check('Se recorrieron los estados', ['REPARTIR_CARTAS', 'TURNO_JUGADOR', 'TURNO_IA', 'VALIDAR_JUGADA'].every((s) => sim.states.includes(s)), sim.states.join(','));
check('Hubo conteo de cartón (más de un mazo o fin por cartón)', sim.states.includes('CONTEO_CARTON') || sim.decks >= 1, String(sim.decks));
await wait(1000); await shot('04_final');
// ---------- fondo de Quito y pantalla de victoria ----------
const vic = await page.evaluate(async () => {
  const d = CU._debug, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { fondo: CU.CFG.FONDO, frase: CU.TEXT.victoriaFrase };
  // chica 1 → pantalla de fin de chica y la partida sigue
  d.newGame(0); await sleep(200); d.game.a.score = 6; d.game.p.score = 40; d.checkWin(); await sleep(100);
  out.chica1 = { s: d.state, chicas: { ...d.game.chicas }, zap: d.game.chicaResult.zap === d.game.a, fiesta: CU.Draw.Victory.isOn() };
  for (let i = 0; i < 5; i++) d.render();
  const hold = CU.CFG.CHICA_HOLD; CU.CFG.CHICA_HOLD = 0.2;
  while (d.state === 'FIN_CHICA') await sleep(30);
  CU.CFG.CHICA_HOLD = hold;
  out.chica2 = { s: d.state, p: d.game.p.score, a: d.game.a.score, chicaNo: d.game.chicaNo, hands: d.game.p.hand.length };
  // chica 2 ganada → partida terminada con cartel
  d.game.p.score = 40; d.checkWin(); await sleep(300);
  out.gana = { s: d.state, fiesta: CU.Draw.Victory.isOn(), chicas: { ...d.game.chicas } };
  for (let i = 0; i < 20; i++) d.render();                                 // dibuja el cartel sin errores
  d.newGame(0); await sleep(200); d.game.chicas.a = 1; d.game.a.score = 40; d.checkWin(); await sleep(200);
  out.pierde = { s: d.state, fiesta: CU.Draw.Victory.isOn() };
  return out;
});
check('Fondo del Centro Histórico activo (CFG.FONDO = quito)', vic.fondo === 'quito');
check('Frase de victoria literal', vic.frase === '¡Qué bien chullita, tómate un canelazo por haber ganado!', vic.frase);
check('§2: ganar la 1.ª chica no termina la partida (FIN_CHICA, 1–0, sin confeti)', vic.chica1.s === 'FIN_CHICA' && vic.chica1.chicas.p === 1 && !vic.chica1.fiesta, JSON.stringify(vic.chica1));
check('§16: zapatería al rival que terminó la chica con 6 puntos', vic.chica1.zap === true);
check('La 2.ª chica empieza en 0–0 con mano nueva', vic.chica2.p === 0 && vic.chica2.a === 0 && vic.chica2.chicaNo === 2 && vic.chica2.s !== 'FIN_CHICA', JSON.stringify(vic.chica2));
check('Victoria (2 chicas) → cartel con confeti y canelazos', vic.gana.s === 'JUEGO_TERMINADO' && vic.gana.fiesta && vic.gana.chicas.p === 2, JSON.stringify(vic.gana));
check('Derrota → sin confeti', vic.pierde.s === 'JUEGO_TERMINADO' && !vic.pierde.fiesta, JSON.stringify(vic.pierde));

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
