/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: js/rules.js — Reglas del Cuarenta como funciones puras, compartidas por el cliente y el servidor
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.8.0
 */
/*
 * Un solo archivo de reglas para:
 *  - el navegador (script clásico, sin módulos ES, funciona con file://) → CU.Rules
 *  - Node (server/match.js, árbitro del modo online) → require('../www/js/rules.js')
 * Así la IA local y el servidor aplican EXACTAMENTE las mismas reglas.
 * Depende de config.js (CU.RULES, CU.RANKS, CU.SUITS), que debe cargarse antes.
 */
(function (root) {
  'use strict';
  const CU = root.CU = root.CU || {};
  const R = CU.RULES;
  if (!R) throw new Error('rules.js necesita config.js cargado antes');


  const Rules = {
    makeDeck() {
      const deck = [];
      for (const s of CU.SUITS) for (const r of CU.RANKS) deck.push({ id: s.id + '-' + r.id, rank: r, suit: s });
      return deck;
    },
    // Fisher–Yates. `rnd()` ∈ [0, 1): el cliente usa Math.random; el servidor, crypto (no predecible).
    shuffle(arr, rnd = Math.random) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    },
    // Una carta participa en sumas solo si es As–7. Las figuras (J, Q, K) NUNCA suman (Punto 3).
    isSumable(c) { return Number.isInteger(c.rank.value) && c.rank.value >= 1 && c.rank.value <= 7; },
    // ¿`cards` es una captura por suma válida para `card`? (≥ 2 cartas, todas As–7, suma exacta)
    validateSuma(card, cards) {
      if (!Rules.isSumable(card) || cards.length < 2 || !cards.every(Rules.isSumable)) return false;
      return cards.reduce((a, c) => a + c.rank.value, 0) === card.rank.value;
    },
    // Subconjunto sumable que da exactamente `target`; prefiere el que más cartas levanta.
    // Filtra las figuras AQUÍ (no solo en quien llama): en JS `null + 3 === 3`, una figura contaría como 0.
    bestSum(cards, target) {
      let best = null;
      cards = cards.filter(Rules.isSumable);
      const n = cards.length;
      for (let mask = 1; mask < (1 << n); mask++) {
        let sum = 0, cnt = 0;
        for (let i = 0; i < n; i++) if (mask & (1 << i)) { sum += cards[i].rank.value; cnt++; }
        if (sum === target && cnt >= 2 && (!best || cnt > best.length)) {
          best = []; for (let i = 0; i < n; i++) if (mask & (1 << i)) best.push(cards[i]);
        }
      }
      return best;
    },
    // CAÍDA (Punto 6): la carta jugada se empareja POR IGUAL con la carta exacta que el rival lanzó en el turno
    // inmediatamente anterior. No es caída si esa carta solo cae por escalera o por suma.
    // Bug corregido (v1.4.1): antes bastaba con que `lastPlayedCard` estuviera entre lo levantado, y la escalera
    // (p. ej. A propio → 2 del rival) daba una caída falsa.
    checkCaida(card, matched, lastPlayedCard) {
      return !!lastPlayedCard && !!matched && matched === lastPlayedCard && card.rank.order === lastPlayedCard.rank.order;
    },
    // Qué levanta `card` sobre `table`. lastPlayedCard = carta que el rival acaba de lanzar (o null).
    // Orden: 1) carta igual (prefiere la recién lanzada) 2) suma (As–7) 3) escalera ascendente desde la carta jugada.
    findCapture(card, table, lastPlayedCard) {
      let taken = [], kind = null, matched = null;
      const same = table.filter((c) => c.rank.order === card.rank.order);
      if (same.length) {
        matched = lastPlayedCard && same.includes(lastPlayedCard) ? lastPlayedCard : same[0];
        taken.push(matched); kind = 'igual';
      } else if (Rules.isSumable(card)) {                     // una figura nunca captura por suma
        const sub = Rules.bestSum(table, card.rank.value);
        if (sub && Rules.validateSuma(card, sub)) { taken = sub; kind = 'suma'; }
      }
      if (kind === 'igual' || (kind === 'suma' && R.ESCALERA_TRAS_SUMA)) {
        for (let next = card.rank.order + 1; ; next++) {
          const c = table.find((t) => t.rank.order === next && !taken.includes(t));
          if (!c) break;
          taken.push(c);
        }
      }
      if (!kind) return null;
      return {
        kind, taken,
        caida: kind === 'igual' && Rules.checkCaida(card, matched, lastPlayedCard),
        limpia: taken.length === table.length,
      };
    },
    // Puntos de una jugada aplicando la regla de 38.
    playPoints(cap, score) {
      if (!cap) return { points: 0, caida: false, limpia: false };
      const blocked38 = R.REGLA_38 && score === 38;
      const caida = cap.caida, limpia = cap.limpia && !blocked38;
      return { points: (caida ? R.CAIDA : 0) + (limpia ? R.LIMPIA : 0), caida, limpia, limpiaAnulada: cap.limpia && blocked38 };
    },
    // Ronda al recibir la mano: tres iguales (+2) o cuatro iguales (gana la chica).
    checkRonda(hand, score) {
      const count = {};
      for (const c of hand) count[c.rank.order] = (count[c.rank.order] || 0) + 1;
      const max = Math.max(...Object.values(count));
      if (max >= 4 && R.CUATRO_IGUALES_GANA) return { type: 'cuatro', points: 0 };
      if (max === 3) {
        // Manual §9: quien supera 30 puntos ya no cobra ronda · §11: con 38 tampoco.
        const blocked = (R.REGLA_38 && score === 38) || score > R.RONDA_MAX_SCORE;
        return { type: 'ronda', points: blocked ? 0 : R.RONDA, blocked };
      }
      return null;
    },
    // Cartón: con más cartas que el rival y al menos 20 → 6 + 1 por carta extra (redondeado a par).
    cartonPoints(n) {
      if (n < R.CARTON_MIN) return 0;
      let p = R.CARTON_BASE + (n - R.CARTON_MIN);
      if (R.CARTON_REDONDEO_PAR && p % 2) p++;
      return p;
    },
    // Conteo (manual §10). dealerIsA = A repartió ESTE mazo; el siguiente reparte B.
    //  A) más cartas y al menos 20 → cartón · B) empate → «dos por dar» a quien reparte a continuación
    //  C) «dos por falla»: quien no levantó ni una carta da 2 puntos al rival · §11: con 38 no suma nada.
    carton(nA, nB, scoreA, scoreB, dealerIsA) {
      const blocked = (s) => (R.REGLA_38 && s === 38) || (R.CARTON_BLOQUEO_30 && s >= 30);
      const res = { a: 0, b: 0, tie: nA === nB, dosPorDar: null, carton: null, falla: null };
      if (res.tie) {
        const nextIsA = !dealerIsA;
        if (nextIsA ? !blocked(scoreA) : !blocked(scoreB)) { res[nextIsA ? 'a' : 'b'] += R.DOS_POR_DAR; res.dosPorDar = nextIsA ? 'a' : 'b'; }
      } else {
        const aWins = nA > nB, pts = Rules.cartonPoints(aWins ? nA : nB);
        if (pts && !blocked(aWins ? scoreA : scoreB)) { res[aWins ? 'a' : 'b'] += pts; res.carton = aWins ? 'a' : 'b'; }
      }
      if (R.DOS_POR_FALLA) {
        if (nB === 0 && nA > 0 && !blocked(scoreA)) { res.a += R.DOS_POR_FALLA; res.falla = 'b'; }
        if (nA === 0 && nB > 0 && !blocked(scoreB)) { res.b += R.DOS_POR_FALLA; res.falla = 'a'; }
      }
      return res;
    },
    // Manual §15B: 4 caídas seguidas ganan la chica. streak = [n0, n1] (se modifica).
    // Seguidas = en turnos consecutivos del mismo jugador; se corta si no hace caída o si el rival le hace una.
    caidaStreak(streak, p, caida) {
      if (caida) { streak[p]++; streak[1 - p] = 0; } else streak[p] = 0;
      return R.CAIDAS_SEGUIDAS > 0 && streak[p] >= R.CAIDAS_SEGUIDAS;
    },
    // Manual §16: zapatería = terminar la chica con menos de 10 puntos.
    zapateria(score) { return score < R.ZAPATERIA_MENOS_DE; },
  };
  CU.Rules = Rules;

  if (typeof module !== 'undefined' && module.exports) module.exports = Rules;
})(typeof window !== 'undefined' ? window : globalThis);
