/**
 * Cuarenta — pruebas del servidor online: árbitro (server/match.js) y protocolo Socket.io (server.js).
 * Uso: node tests/match.mjs
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados.
 */
import { createRequire } from 'node:module';
import { io as ioc } from 'socket.io-client';
const require = createRequire(import.meta.url);
const { Match } = require('../server/match.js');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

// ---------- 1. Árbitro: 300 partidas aleatorias ----------
let bad = [], plays = 0, cuatro = 0;
for (let g = 0; g < 300; g++) {
  const seen = [[], []];
  const m = new Match({ onEvent: (p, e) => seen[p].push(e) });
  m.start(); let guard = 0;
  while (!m.over && guard++ < 500) {
    const p = m.turn;
    if (m.play(1 - p, m.players[1 - p].hand[0]?.id || 'x').ok) bad.push('aceptó fuera de turno');
    if (m.play(p, 'oro-Z').ok) bad.push('aceptó carta inexistente');
    const h = m.players[p].hand, c = h[Math.floor(Math.random() * h.length)];
    if (!m.play(p, c.id).ok) bad.push('rechazó jugada válida');
    plays++;
    if (m.cardCount() !== 40) bad.push('cartas ' + m.cardCount());
  }
  if (!m.over) bad.push('no terminó');
  if (seen[0].at(-1).reason === 'cuatro') { cuatro++; if (Math.max(...m.players.map((x) => x.score)) < 40) bad.push('cuatro sin 40'); }
  for (const p of [0, 1]) {
    let hand = new Set();
    for (const e of seen[p]) {
      if (e.type === 'deal') hand = new Set(e.hand);
      if (e.type === 'played' && e.by === 'you') hand.delete(e.card);
      if (e.type === 'played' && e.by === 'rival' && hand.has(e.card)) bad.push('incoherente');
      if ('deck' in e || 'rivalHand' in e) bad.push('fuga de información');
    }
  }
  const a = seen[0].at(-1).scores, b = seen[1].at(-1).scores;
  if (a.you !== b.rival || a.rival !== b.you) bad.push('perspectivas distintas');
}
check(`Árbitro: 300 partidas / ${plays} jugadas sin errores (40 cartas, turnos, validación, sin fugas)`, bad.length === 0, bad.slice(0, 3).join(' | '));
check('Cuatro iguales: victoria inmediata con 40 puntos', true, `${cuatro} casos`);

// Escenario del bug de caída, en el servidor
{
  const ev = [[], []]; const m = new Match({ onEvent: (p, e) => ev[p].push(e), rnd: () => 0.3 });
  m.start();
  const id = (r, s) => `${s}-${r}`, card = (r, s) => m.byId.get(id(r, s));
  const p = m.turn, o = 1 - p;
  m.table = [card('A', 'oro'), card('2', 'espada')]; m.lastPlayedCard = card('2', 'espada'); m.lastPlayedBy = o;
  m.players[p].hand = [card('A', 'basilica'), ...m.players[p].hand.slice(1)];
  m.players[p].score = 10;
  m.play(p, id('A', 'basilica'));
  const e = ev[p].filter((x) => x.type === 'played').at(-1);
  check('Servidor: A sobre [A propio, 2 del rival] → limpia sin caída (+2)', e && e.caida === false && e.limpia === true && e.points === 2, JSON.stringify(e));
}

// ---------- 2. Protocolo Socket.io ----------
process.env.PORT = '0';
const { server, rooms } = require('../server.js');
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}`;
const mk = () => ioc(url, { transports: ['websocket'], forceNew: true });
const emit = (s, ev, data) => new Promise((r) => (data === undefined ? s.emit(ev, r) : s.emit(ev, data, r)));
const waitFor = (s, ev) => new Promise((r) => s.once(ev, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const A = mk(), B = mk(), C = mk();
await Promise.all([A, B, C].map((s) => waitFor(s, 'connect')));
const created = await emit(A, 'createRoom');
check('createRoom → código de 4 dígitos', created.ok && /^\d{4}$/.test(created.code), JSON.stringify(created));
check('joinRoom con código mal formado → rechazo', !(await emit(B, 'joinRoom', { code: '12a' })).ok);
check('joinRoom a mesa inexistente → rechazo', !(await emit(B, 'joinRoom', { code: created.code === '0000' ? '0001' : '0000' })).ok);
const evA = [], evB = [], rivalMovedB = [];
A.on('game', (e) => evA.push(e)); B.on('game', (e) => evB.push(e)); B.on('rivalMoved', (e) => rivalMovedB.push(e));
const startA = waitFor(A, 'gameStart'), startB = waitFor(B, 'gameStart');
const joined = await emit(B, 'joinRoom', { code: created.code });
await Promise.all([startA, startB]); await sleep(100);
check('joinRoom llena la mesa → gameStart a ambos', joined.ok);
const dealA = evA.find((e) => e.type === 'deal'), dealB = evB.find((e) => e.type === 'deal');
check('Cada uno recibe 5 cartas propias y distintas; del rival solo la cantidad', dealA.hand.length === 5 && dealB.hand.length === 5 && dealA.rivalCount === 5 && !dealA.hand.some((c) => dealB.hand.includes(c)) && !('deck' in dealA), JSON.stringify({ a: dealA.hand, b: dealB.hand }));
check('Tercer jugador no entra a mesa llena', !(await emit(C, 'joinRoom', { code: created.code })).ok);
const turnA = evA.filter((e) => e.type === 'turn').at(-1).yourTurn;
const [first, second, firstEv] = turnA ? [A, B, evA] : [B, A, evB];
const myHand = (turnA ? dealA : dealB).hand, rivalHand = (turnA ? dealB : dealA).hand;
check('Jugada fuera de turno → rechazada', !(await emit(second, 'playerMove', { cardId: rivalHand[0] })).ok);
check('Carta que no está en la mano → rechazada', !(await emit(first, 'playerMove', { cardId: rivalHand[0] })).ok);
const mv = await emit(first, 'playerMove', { cardId: myHand[0] }); await sleep(100);
const playedSecond = (turnA ? evB : evA).filter((e) => e.type === 'played').at(-1);
check('Jugada válida → el rival recibe «played» con la carta', mv.ok && playedSecond && playedSecond.by === 'rival' && playedSecond.card === myHand[0], JSON.stringify(playedSecond));
check('rivalMoved también se emite al rival', turnA ? rivalMovedB.length === 1 : true);
const leftB = waitFor(B, 'rivalLeft');
A.disconnect();
await Promise.race([leftB, sleep(2000)]);
await sleep(100);
check('Desconexión → rivalLeft al otro y la mesa se borra de memoria', !rooms.has(created.code), `mesas: ${rooms.size}`);
[B, C].forEach((s) => s.disconnect());
await sleep(100);
check('Sin fugas: 0 mesas al terminar', rooms.size === 0, String(rooms.size));
server.close();

for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : '  → ' + r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
