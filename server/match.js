/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: server/match.js — Árbitro autoritativo de una partida online (1 contra 1)
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.9.0
 */
/*
 * El servidor es la ÚNICA fuente de verdad:
 *  - baraja con crypto (no predecible) y guarda el mazo; los clientes nunca lo reciben;
 *  - cada jugador recibe SOLO su mano; del rival solo sabe cuántas cartas tiene;
 *  - valida turno y carta en cada jugada y aplica las mismas reglas que el juego local (www/js/rules.js);
 *  - emite eventos desde la perspectiva de cada jugador («you» / «rival»).
 *
 * Eventos emitidos con onEvent(playerIndex, evento):
 *   deal     { hand:[ids], rivalCount, deckCount, deckNo, dealerIsYou }
 *   ronda    { who:'you'|'rival', kind:'ronda'|'cuatro', points, scores }
 *   turn     { yourTurn }
 *   played   { by, card, capture:{ kind, taken:[ids] }|null, points, caida, limpia, limpiaAnulada, scores }
 *   carton   { you, rival, add:{ you, rival }, tie, dosPorDar, falla, sobrantes:[ids], sobrantesTo, scores }
 *   chicaOver{ winner, reason, scores, chicas:{ you, rival }, zapateria:'you'|'rival'|null }   (sigue otra chica)
 *   gameOver { winner, reason, scores, chicas, zapateria }                                     (partida a 2 de 3)
 */
'use strict';
const crypto = require('node:crypto');
require('../www/js/config.js');
const Rules = require('../www/js/rules.js');
const CU = globalThis.CU;
const R = CU.RULES;

const secureRandom = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32;

class Match {
  /** @param {{ onEvent:(player:number, event:object)=>void, rnd?:()=>number }} opts */
  constructor({ onEvent, rnd = secureRandom }) {
    this.onEvent = onEvent;
    this.rnd = rnd;
    this.players = [0, 1].map(() => ({ hand: [], pile: [], score: 0, chicas: 0 }));
    this.streak = [0, 0];                                            // caídas seguidas (manual §15B)
    this.chicaNo = 1;
    this.byId = new Map(Rules.makeDeck().map((c) => [c.id, c]));
    this.deck = []; this.table = [];
    this.dealer = this.rnd() < 0.5 ? 0 : 1;
    this.turn = null; this.deckNo = 0;
    this.lastPlayedCard = null; this.lastPlayedBy = null; this.lastCapturer = null;
    this.over = false; this.winner = null;
  }

  // ------------------------------------------------------------------ utilidades
  scores(p) { return { you: this.players[p].score, rival: this.players[1 - p].score }; }
  chicas(p) { return { you: this.players[p].chicas, rival: this.players[1 - p].chicas }; }
  who(p, target) { return p === target ? 'you' : 'rival'; }
  send(p, e) { this.onEvent(p, e); }
  both(build) { for (const p of [0, 1]) this.send(p, build(p)); }
  ids(cards) { return cards.map((c) => c.id); }

  // ------------------------------------------------------------------ flujo
  start() { this.newDeck(true); }

  newDeck(first = false) {
    this.deck = Rules.shuffle(Rules.makeDeck(), this.rnd);
    this.table = []; this.players.forEach((pl) => { pl.pile = []; });
    this.lastPlayedCard = null; this.lastPlayedBy = null; this.lastCapturer = null;
    if (!first) this.dealer = 1 - this.dealer;                     // el que da se alterna por mazo
    this.deckNo++;
    this.deal();
  }

  deal() {
    if (!R.CAIDA_ENTRE_REPARTOS) { this.lastPlayedCard = null; this.lastPlayedBy = null; }
    const mano = 1 - this.dealer;                                  // recibe y juega primero el que no da
    for (const p of [mano, this.dealer]) for (let i = 0; i < 5; i++) this.players[p].hand.push(this.deck.pop());
    this.both((p) => ({
      type: 'deal', hand: this.ids(this.players[p].hand), rivalCount: this.players[1 - p].hand.length,
      deckCount: this.deck.length, deckNo: this.deckNo, dealerIsYou: this.dealer === p,
    }));
    for (const p of [mano, this.dealer]) {                         // ronda y cuatro iguales al recibir
      const r = Rules.checkRonda(this.players[p].hand, this.players[p].score);
      if (!r) continue;
      if (r.type === 'cuatro') {                                   // doble ronda: gana la chica de inmediato
        this.players[p].score = Math.max(this.players[p].score, R.WIN_POINTS);
        this.both((q) => ({ type: 'ronda', who: this.who(q, p), kind: 'cuatro', points: 0, scores: this.scores(q) }));
        return this.finish(p, 'cuatro');
      }
      this.players[p].score += r.points;
      this.both((q) => ({ type: 'ronda', who: this.who(q, p), kind: 'ronda', points: r.points, scores: this.scores(q) }));
    }
    if (this.checkWin()) return;
    this.setTurn(mano);
  }

  setTurn(p) { this.turn = p; this.both((q) => ({ type: 'turn', yourTurn: q === p })); }

  /** Jugada de `p`. Devuelve { ok } o { ok:false, error }. Nunca lanza por entrada del cliente. */
  play(p, cardId) {
    if (this.over) return { ok: false, error: 'La partida terminó' };
    if (p !== this.turn) return { ok: false, error: 'No es tu turno' };
    const me = this.players[p], card = me.hand.find((c) => c.id === cardId);
    if (!card) return { ok: false, error: 'Esa carta no está en tu mano' };
    me.hand.splice(me.hand.indexOf(card), 1);
    const other = 1 - p;
    const last = this.lastPlayedBy === other && this.table.includes(this.lastPlayedCard) ? this.lastPlayedCard : null;
    const cap = Rules.findCapture(card, this.table, last);
    let pts = { points: 0, caida: false, limpia: false, limpiaAnulada: false };
    if (!cap) {
      this.table.push(card);
      this.lastPlayedCard = card; this.lastPlayedBy = p;
    } else {
      pts = Rules.playPoints(cap, me.score);
      me.score += pts.points;
      this.table = this.table.filter((c) => !cap.taken.includes(c));
      me.pile.push(card, ...cap.taken);
      this.lastCapturer = p;
      this.lastPlayedCard = null; this.lastPlayedBy = null;      // levantó (incluida la limpia): no hay caída posible
    }
    this.both((q) => ({
      type: 'played', by: this.who(q, p), card: card.id,
      capture: cap ? { kind: cap.kind, taken: this.ids(cap.taken) } : null,
      points: pts.points, caida: !!pts.caida, limpia: !!pts.limpia, limpiaAnulada: !!pts.limpiaAnulada, scores: this.scores(q),
    }));
    if (Rules.caidaStreak(this.streak, p, !!pts.caida)) {             // 4 caídas seguidas: gana la chica
      me.score = Math.max(me.score, R.WIN_POINTS);
      this.finish(p, 'caidas'); return { ok: true };
    }
    if (this.checkWin()) return { ok: true };
    if (this.players[0].hand.length === 0 && this.players[1].hand.length === 0) {
      if (this.deck.length) this.deal(); else this.carton();
    } else this.setTurn(other);
    return { ok: true };
  }

  carton() {
    let sobrantes = [], to = null;
    if (R.SOBRANTES_AL_ULTIMO && this.table.length && this.lastCapturer !== null) {
      sobrantes = this.table.slice(); to = this.lastCapturer;
      this.players[to].pile.push(...sobrantes); this.table = [];
    }
    const [a, b] = this.players;
    const res = Rules.carton(a.pile.length, b.pile.length, a.score, b.score, this.dealer === 0);
    a.score += res.a; b.score += res.b;
    this.both((q) => ({
      type: 'carton', you: this.players[q].pile.length, rival: this.players[1 - q].pile.length,
      add: q === 0 ? { you: res.a, rival: res.b } : { you: res.b, rival: res.a }, tie: res.tie,
      dosPorDar: res.dosPorDar && this.who(q, res.dosPorDar === 'a' ? 0 : 1),
      cartonTo: res.carton && this.who(q, res.carton === 'a' ? 0 : 1),
      falla: res.falla && this.who(q, res.falla === 'a' ? 0 : 1),
      sobrantes: this.ids(sobrantes), sobrantesTo: to === null ? null : this.who(q, to), scores: this.scores(q),
    }));
    if (!this.checkWin()) this.newDeck();
  }

  checkWin() {
    const w = this.players.findIndex((pl) => pl.score >= R.WIN_POINTS);
    if (w < 0) return false;
    this.finish(w, 'cuarenta');
    return true;
  }

  // Fin de una chica: si alguien llegó a 2 chicas termina la partida; si no, empieza la siguiente.
  finish(p, reason) {
    this.turn = null;
    this.players[p].chicas++;
    const zap = this.players.findIndex((pl, i) => i !== p && Rules.zapateria(pl.score));
    const over = this.players[p].chicas >= R.CHICAS_PARA_GANAR;
    if (over) { this.over = true; this.winner = p; }
    this.both((q) => ({
      type: over ? 'gameOver' : 'chicaOver', winner: this.who(q, p), reason, scores: this.scores(q),
      chicas: this.chicas(q), zapateria: zap < 0 ? null : this.who(q, zap),
    }));
    if (!over) this.newChica();
  }

  newChica() {
    this.chicaNo++;
    this.players.forEach((pl) => { pl.score = 0; pl.hand = []; });
    this.streak = [0, 0];
    this.newDeck();                                                // el que da sigue alternándose
  }

  /** Para pruebas: total de cartas en juego (debe ser siempre 40). */
  cardCount() {
    return this.deck.length + this.table.length + this.players.reduce((n, pl) => n + pl.hand.length + pl.pile.length, 0);
  }
}

module.exports = { Match };
