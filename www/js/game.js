/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: js/game.js — Intérprete de las reglas del Cuarenta, IA, estados, sonido y render
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.0.0
 */
(function (CU) {
  'use strict';
  const C = CU.CFG, R = CU.RULES, W = C.W, H = C.H, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const ease = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);

  // =====================================================================
  //  1. REGLAS (funciones puras: sin pantalla ni sonido)
  // =====================================================================
  const Rules = {
    makeDeck() {
      const deck = [];
      for (const s of CU.SUITS) for (const r of CU.RANKS) deck.push({ id: s.id + '-' + r.id, rank: r, suit: s });
      return deck;
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    },
    // Subconjunto de cartas numéricas que suma exactamente `target`; prefiere el que más cartas levanta.
    bestSum(cards, target) {
      let best = null;
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
    // Qué levanta `card` sobre `table`. last = carta que el rival acaba de jugar (para la caída).
    // Orden: 1) carta igual (prefiere la recién jugada) 2) suma (As–7) 3) escalera ascendente desde la carta jugada.
    findCapture(card, table, last) {
      let taken = [], kind = null;
      const same = table.filter((c) => c.rank.order === card.rank.order);
      if (same.length) {
        taken.push(last && same.includes(last) ? last : same[0]); kind = 'igual';
      } else if (card.rank.value && (!R.SUMA_SOLO_NUMEROS || card.rank.value)) {
        const nums = table.filter((c) => c.rank.value);
        const sub = Rules.bestSum(nums, card.rank.value);
        if (sub) { taken = sub; kind = 'suma'; }
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
        caida: kind === 'igual' && !!last && taken.includes(last),
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
        const blocked = R.REGLA_38 && score === 38;
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
    carton(nA, nB, scoreA, scoreB, dealerIsA) {
      const blocked = (s) => (R.REGLA_38 && s === 38) || (R.CARTON_BLOQUEO_30 && s >= 30);
      if (nA === nB) {
        const s = dealerIsA ? scoreA : scoreB;
        return { a: dealerIsA && !blocked(s) ? R.DOS_POR_DAR : 0, b: !dealerIsA && !blocked(s) ? R.DOS_POR_DAR : 0, tie: true };
      }
      const aWins = nA > nB;
      const pts = Rules.cartonPoints(aWins ? nA : nB);
      return { a: aWins && !blocked(scoreA) ? pts : 0, b: !aWins && !blocked(scoreB) ? pts : 0, tie: false };
    },
  };
  CU.Rules = Rules;

  // =====================================================================
  //  2. SONIDO (Web Audio sintetizado, sin archivos)
  // =====================================================================
  const Sfx = (() => {
    let ac = null, out = null, noiseBuf = null, muted = false;
    try { muted = localStorage.getItem('cu.muted') === '1'; } catch { /* sin almacenamiento */ }
    function audio() {
      if (!ac) {
        const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
        ac = new A(); out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(type, f0, f1, t, dur, g0, o = {}) {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(g0, t + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
      node.connect(g); g.connect(out); osc.start(t); osc.stop(t + dur + 0.05);
    }
    function noise(t, dur, g0, type, f0, f1) {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(f0, t);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
    }
    const ok = () => !muted && audio();
    const t0 = () => ac.currentTime + 0.01;
    // escala de pasacalle (La menor armónica) para fanfarrias cortas
    const N = { A3: 220, C4: 261.6, E4: 329.6, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, A5: 880 };
    return {
      unlock() { if (!muted) audio(); },
      isMuted: () => muted,
      toggle() { muted = !muted; try { localStorage.setItem('cu.muted', muted ? '1' : '0'); } catch { /* */ } if (!muted) audio(); return muted; },
      deal() { if (!ok()) return; noise(t0(), 0.05, 0.25, 'highpass', 3000); },
      select() { if (!ok()) return; tone('triangle', 880, 880, t0(), 0.06, 0.12); },
      place() { if (!ok()) return; const t = t0(); noise(t, 0.08, 0.35, 'bandpass', 1200, 500); tone('sine', 180, 90, t, 0.08, 0.25); },
      capture() { if (!ok()) return; const t = t0(); noise(t, 0.25, 0.3, 'bandpass', 600, 3000); },
      caida() { if (!ok()) return; const t = t0(); tone('sine', 110, 45, t, 0.3, 0.9); [N.E5, N.A5].forEach((f, i) => tone('square', f, f, t + 0.05 + i * 0.12, 0.18, 0.12, { lp: 3000 })); },
      limpia() { if (!ok()) return; const t = t0(); [N.A4, N.C5, N.E5, N.A5].forEach((f, i) => tone('triangle', f, f, t + i * 0.07, 0.4, 0.18)); },
      ronda() { if (!ok()) return; const t = t0(); [N.E4, N.A4, N.E5].forEach((f, i) => tone('triangle', f, f * 1.002, t + i * 0.1, 0.9, 0.16)); },
      tick() { if (!ok()) return; tone('square', 1200, 1200, t0(), 0.03, 0.06); },
      win() { if (!ok()) return; const t = t0(); [N.A3, N.C4, N.E4, N.A4, N.B4, N.C5, N.E5, N.A5].forEach((f, i) => tone('square', f, f, t + i * 0.09, 0.22, 0.1, { lp: 2400 })); tone('sine', 110, 55, t + 0.72, 0.5, 0.8); },
      lose() { if (!ok()) return; const t = t0(); [N.E4, N.C4, N.B4 / 2, N.A3].forEach((f, i) => tone('triangle', f, f, t + i * 0.18, 0.35, 0.16)); },
    };
  })();
  CU.Sfx = Sfx;

  // =====================================================================
  //  3. IA: cada leyenda evalúa sus cartas con su propio estilo
  // =====================================================================
  // Probabilidad de que el rival tenga al menos una carta del orden `order` (hipergeométrica).
  function probHolds(order, ctx) {
    let k, pool;
    if (ctx.memory) {
      const seen = ctx.seen.filter((c) => c.rank.order === order).length + ctx.myHand.filter((c) => c.rank.order === order).length;
      k = Math.max(0, 4 - seen); pool = Math.max(1, 40 - ctx.seen.length - ctx.myHand.length);
    } else { k = 2; pool = 22; }                                 // estimación ingenua sin contar cartas
    const h = ctx.oppHandSize;
    if (k === 0 || h === 0) return 0;
    let pNone = 1;
    for (let i = 0; i < h; i++) pNone *= Math.max(0, (pool - k - i)) / Math.max(1, (pool - i));
    return 1 - pNone;
  }

  function aiChoose(rival, hand, table, ctx) {
    const st = rival.style;
    let best = null;
    for (const card of hand) {
      const cap = Rules.findCapture(card, table, ctx.last);
      const pts = Rules.playPoints(cap, ctx.myScore);
      let s = 0;
      if (cap) {
        s += st.points * pts.points * 10 + st.cards * cap.taken.length * 2.2;
        const remain = table.filter((t) => !cap.taken.includes(t));
        // ¿le dejo una limpia fácil? (1 carta sola en la mesa)
        if (remain.length === 1) s -= st.risk * probHolds(remain[0].rank.order, ctx) * 2 * 10;
      } else {
        // la carta queda en la mesa: riesgo de caída (+2) y de limpia si queda sola
        const p = probHolds(card.rank.order, ctx);
        s -= st.risk * p * (R.CAIDA + (table.length === 0 ? R.LIMPIA : 0)) * 10;
        // ¿abre una suma para el rival?
        if (card.rank.value) for (const t of table) if (t.rank.value && t.rank.value + card.rank.value <= 7) s -= st.risk * probHolds(t.rank.value + card.rank.value, ctx) * 3;
        s += (card.rank.value ? 0 : 0.5);                         // botar figuras suele ser más seguro
      }
      if (st.lookahead && !cap) s -= 2 * table.filter((t) => t.rank.order === card.rank.order + 1).length;  // no regalar escaleras
      s += st.noise * rand(-6, 6);
      if (!best || s > best.s) best = { card, s };
    }
    return best.card;
  }

  // =====================================================================
  //  4. ESTADO DEL JUEGO
  // =====================================================================
  const S = {
    MENU: 'MENU', REPARTIR_CARTAS: 'REPARTIR_CARTAS', TURNO_JUGADOR: 'TURNO_JUGADOR', TURNO_IA: 'TURNO_IA',
    VALIDAR_JUGADA: 'VALIDAR_JUGADA', CONTEO_CARTON: 'CONTEO_CARTON', JUEGO_TERMINADO: 'JUEGO_TERMINADO',
  };
  let state = S.MENU, stateTime = 0, simTime = 0, frames = 0;
  let G = null;            // partida
  const fx = [];           // textos y partículas
  let menuHover = -1;

  function setState(s) { state = s; stateTime = 0; }

  function newGame(rivalIndex) {
    const rival = CU.RIVALS[rivalIndex];
    G = {
      rival, deck: [], table: [], seen: [],
      p: { name: 'Tú', hand: [], pile: [], score: 0 },
      a: { name: rival.name, hand: [], pile: [], score: 0 },
      dealerIsP: Math.random() < 0.5, turnP: true, last: null, lastBy: null, lastCapturer: null,
      selected: null, play: null, bubble: null, winner: null, carton: null, dealt: 0, deckNo: 0,
    };
    say('hello');
    newDeck();
  }

  function newDeck() {
    G.deck = Rules.shuffle(Rules.makeDeck());
    G.table = []; G.seen = []; G.p.pile = []; G.a.pile = []; G.last = null; G.lastBy = null; G.lastCapturer = null; G.play = null; G.selected = null;
    G.dealerIsP = !G.dealerIsP; G.deckNo++;
    startDeal();
  }

  function startDeal() {
    G.dealQueue = [];
    // se reparte de 5 en 5: primero al que no da (la «mano»)
    const first = G.dealerIsP ? G.a : G.p, second = first === G.p ? G.a : G.p;
    for (const who of [first, second]) for (let i = 0; i < C.HAND_SIZE; i++) G.dealQueue.push(who);
    G.dealTimer = 0; G.turnP = !G.dealerIsP;
    setState(S.REPARTIR_CARTAS);
  }

  // ------------------------------------------------------------------ posiciones
  const HAND_Y = 538, AI_HAND_Y = 176, TABLE_TOP = 214, TABLE_BOTTOM = 448;
  function handPos(i, n) { const gap = 66, x0 = W / 2 - ((n - 1) * gap) / 2; return { x: x0 + i * gap, y: HAND_Y }; }
  function aiHandPos(i, n) { const gap = 30, x0 = W / 2 - ((n - 1) * gap) / 2 + 30; return { x: x0 + i * gap, y: AI_HAND_Y }; }
  function tablePos(i, n) {
    const cols = n > 15 ? 6 : 5, rows = Math.ceil(n / cols);
    const cw = n > 15 ? 46 : C.CARD_W + 8, ch = Math.min(C.CARD_H + 8, (TABLE_BOTTOM - TABLE_TOP) / Math.max(1, rows));
    const row = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - row * cols);
    return { x: W / 2 - ((inRow - 1) * cw) / 2 + col * cw, y: TABLE_TOP + ch / 2 + row * ch + (rows < 3 ? (3 - rows) * ch / 2 - 10 : 0) };
  }
  const PILE_P = { x: 326, y: 470 }, PILE_A = { x: 326, y: 182 }, DECK_POS = { x: 34, y: 330 };

  function moveTo(card, x, y, dur) { card.anim = { fx: card.x, fy: card.y, tx: x, ty: y, t: 0, dur }; }
  function layoutTable() { G.table.forEach((c, i) => { const p = tablePos(i, G.table.length); moveTo(c, p.x, p.y, 0.2); }); }
  function layoutHands() {
    G.p.hand.forEach((c, i) => { const p = handPos(i, G.p.hand.length); moveTo(c, p.x, p.y - (c === G.selected ? 16 : 0), 0.15); });
    G.a.hand.forEach((c, i) => { const p = aiHandPos(i, G.a.hand.length); moveTo(c, p.x, p.y, 0.15); });
  }

  // ------------------------------------------------------------------ textos y frases
  function popup(text, x, y, color, size = 28) { fx.push({ type: 'text', text, x, y, color, size, life: 1.6, max: 1.6 }); }
  function say(kind) {
    const list = G.rival.phrases[kind]; if (!list) return;
    G.bubble = { text: pick(list), life: 2.8 };
  }

  // ------------------------------------------------------------------ jugar una carta
  function playCard(who, card) {
    const isP = who === G.p;
    who.hand.splice(who.hand.indexOf(card), 1);
    card.faceUp = true;
    G.selected = null;
    const n = G.table.length + 1, pos = tablePos(n - 1, n);
    moveTo(card, pos.x, pos.y, C.ANIM_PLAY);
    G.play = { who, card, isP, phase: 'move', t: 0 };
    Sfx.place();
    layoutHands();
    setState(S.VALIDAR_JUGADA);
  }

  function resolvePlay() {
    const { who, card, isP } = G.play;
    const other = isP ? G.a : G.p;
    const lastByOther = G.lastBy === other ? G.last : null;
    const cap = Rules.findCapture(card, G.table, lastByOther);
    G.seen.push(card);
    if (!cap) {
      G.table.push(card);
      G.last = card; G.lastBy = who;
      layoutTable();
      G.play.phase = 'done'; G.play.t = 0;
      return;
    }
    const pts = Rules.playPoints(cap, who.score);
    G.play.cap = cap; G.play.pts = pts;
    G.table.push(card);
    G.play.taking = [card, ...cap.taken];
    for (const c of G.play.taking) c.hl = true;
    G.play.phase = 'highlight'; G.play.t = 0;
    who.score += pts.points;
    const cx = W / 2, cy = (TABLE_TOP + TABLE_BOTTOM) / 2;
    if (pts.caida && pts.limpia) { popup('¡CAÍDA Y LIMPIA!', cx, cy, '#ffe066', 26); Sfx.caida(); setTimeout(() => Sfx.limpia(), 250); }
    else if (pts.caida) { popup(CU.TEXT.caida, cx, cy, '#ffe066', 34); Sfx.caida(); }
    else if (pts.limpia) { popup(CU.TEXT.limpia, cx, cy, '#9be7ff', 34); Sfx.limpia(); }
    else Sfx.capture();
    if (pts.points) popup('+' + pts.points, isP ? 70 : 290, isP ? 470 : 182, '#ffe066', 22);
    if (pts.limpiaAnulada) popup(CU.TEXT.regla38, cx, cy + 34, '#ffb3a1', 13);
    if (!isP && (pts.caida || pts.limpia)) say(pts.caida ? 'caida' : 'limpia');
    if (isP && pts.caida) say('suffer');
    G.lastCapturer = who;
    G.last = null; G.lastBy = null;
  }

  function finishCapture() {
    const { who, isP } = G.play;
    const pile = isP ? PILE_P : PILE_A;
    for (const c of G.play.taking) {
      c.hl = false;
      G.table.splice(G.table.indexOf(c), 1);
      who.pile.push(c);
      moveTo(c, pile.x, pile.y, C.ANIM_CAPTURE);
      c.toPile = true;
    }
    layoutTable();
  }

  function afterPlay() {
    const wasP = G.play.isP;
    G.play = null;                       // la jugada terminó: no debe quedar referencia al mazo anterior
    if (checkWin()) return;
    if (G.p.hand.length === 0 && G.a.hand.length === 0) {
      if (G.deck.length > 0) { startDeal(); return; }
      startCarton(); return;
    }
    G.turnP = !wasP;
    setState(G.turnP ? S.TURNO_JUGADOR : S.TURNO_IA);
  }

  function checkWin() {
    const pW = G.p.score >= R.WIN_POINTS, aW = G.a.score >= R.WIN_POINTS;
    if (!pW && !aW) {
      if (G.a.score === 38 && !G.said38) { G.said38 = true; say('thirtyEight'); }
      return false;
    }
    G.winner = pW ? G.p : G.a;
    endGame();
    return true;
  }

  function endGame() {
    fx.length = 0;                       // sin avisos flotando sobre la pantalla final
    setState(S.JUEGO_TERMINADO);
    const pWon = G.winner === G.p;
    say(pWon ? 'lose' : 'win');
    if (pWon) Sfx.win(); else Sfx.lose();
    try {
      const key = 'cu.wins.' + G.rival.id;
      if (pWon) localStorage.setItem(key, String((parseInt(localStorage.getItem(key), 10) || 0) + 1));
    } catch { /* sin almacenamiento */ }
  }

  function startCarton() {
    // sobrantes al último que levantó
    if (R.SOBRANTES_AL_ULTIMO && G.table.length && G.lastCapturer) {
      const pile = G.lastCapturer === G.p ? PILE_P : PILE_A;
      for (const c of G.table) { G.lastCapturer.pile.push(c); moveTo(c, pile.x, pile.y, 0.5); c.toPile = true; }
      G.table = [];
    }
    const nP = G.p.pile.length, nA = G.a.pile.length;
    const res = Rules.carton(nP, nA, G.p.score, G.a.score, G.dealerIsP);
    G.carton = { nP, nA, res, shownP: 0, shownA: 0, applied: false };
    setState(S.CONTEO_CARTON);
  }

  // ------------------------------------------------------------------ paso fijo
  function update(dt) {
    simTime += dt; stateTime += dt; frames++;
    for (const f of fx) { f.life -= dt; f.y -= 18 * dt; }
    for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
    if (!G) return;
    if (G.bubble) { G.bubble.life -= dt; if (G.bubble.life <= 0) G.bubble = null; }
    for (const c of allCards()) {
      if (!c.anim) continue;
      c.anim.t += dt;
      const p = ease(c.anim.t / c.anim.dur);
      c.x = c.anim.fx + (c.anim.tx - c.anim.fx) * p; c.y = c.anim.fy + (c.anim.ty - c.anim.fy) * p;
      if (c.anim.t >= c.anim.dur) { c.anim = null; if (c.toPile) c.hidden = true; }
    }

    switch (state) {
      case S.REPARTIR_CARTAS: {
        G.dealTimer -= dt;
        if (G.dealQueue.length && G.dealTimer <= 0) {
          const who = G.dealQueue.shift(), c = G.deck.pop();
          c.x = DECK_POS.x; c.y = DECK_POS.y; c.faceUp = who === G.p; c.hidden = false; c.toPile = false;
          who.hand.push(c);
          layoutHands();
          Sfx.deal();
          G.dealTimer = C.DEAL_GAP;
        }
        if (!G.dealQueue.length && G.dealTimer <= -Math.min(0.35, C.HIGHLIGHT)) {
          // ronda / cuatro iguales
          for (const who of [G.p, G.a]) {
            const r = Rules.checkRonda(who.hand, who.score);
            if (!r) continue;
            if (r.type === 'cuatro') { popup(CU.TEXT.cuatro, W / 2, 330, '#ffe066', 26); G.winner = who; endGame(); return; }
            who.score += r.points;
            popup(CU.TEXT.ronda + (r.points ? ' +' + r.points : ''), W / 2, who === G.p ? 440 : 230, '#ffe066', 26);
            Sfx.ronda();
            if (who === G.a) G.bubble = { text: '¡Ronda, ronda!', life: 2 };
          }
          if (checkWin()) return;
          setState(G.turnP ? S.TURNO_JUGADOR : S.TURNO_IA);
        }
        break;
      }
      case S.TURNO_IA: {
        if (stateTime >= (G.aiDelay || (G.aiDelay = rand(C.AI_THINK[0], C.AI_THINK[1])))) {
          G.aiDelay = 0;
          const card = aiChoose(G.rival, G.a.hand, G.table, {
            last: G.lastBy === G.p ? G.last : null, myScore: G.a.score, myHand: G.a.hand,
            seen: G.seen, memory: G.rival.style.memory, oppHandSize: G.p.hand.length,
          });
          playCard(G.a, card);
        }
        break;
      }
      case S.VALIDAR_JUGADA: {
        const P = G.play; P.t += dt;
        if (P.phase === 'move' && P.t >= C.ANIM_PLAY) { P.phase = 'resolve'; resolvePlay(); }
        else if (P.phase === 'highlight' && P.t >= C.HIGHLIGHT) { P.phase = 'collect'; P.t = 0; finishCapture(); }
        else if (P.phase === 'collect' && P.t >= C.ANIM_CAPTURE) { P.phase = 'done'; P.t = 0; }
        else if (P.phase === 'done' && P.t >= 0.12) afterPlay();
        break;
      }
      case S.CONTEO_CARTON: {
        const K = G.carton;
        // cuenta carta por carta: primero tu cartón, luego el del rival
        const total = Math.floor(stateTime / C.COUNT_STEP);
        const sp = Math.min(K.nP, total), sa = Math.min(K.nA, Math.max(0, total - K.nP));
        if (sp !== K.shownP || sa !== K.shownA) { K.shownP = sp; K.shownA = sa; if (total % 2 === 0) Sfx.tick(); }
        if (!K.applied && K.shownP >= K.nP && K.shownA >= K.nA) {
          K.applied = true; K.appliedAt = stateTime;
          G.p.score += K.res.a; G.a.score += K.res.b;
          if (K.res.a || K.res.b) Sfx.ronda();
        }
        if (K.applied && stateTime - K.appliedAt > C.CARTON_HOLD) {
          if (checkWin()) return;
          newDeck();
        }
        break;
      }
    }
  }

  function allCards() {
    if (!G) return [];
    const list = [...G.table, ...G.p.hand, ...G.a.hand, ...G.p.pile, ...G.a.pile];
    if (G.play && !list.includes(G.play.card)) list.push(G.play.card);
    return list;
  }

  // =====================================================================
  //  5. ENTRADA
  // =====================================================================
  const canvas = document.getElementById('game');
  const stage = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  let scale = 1;

  function resize() {
    const cs = getComputedStyle(stage);
    const aw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    scale = Math.max(0.1, Math.min(aw / W, ah / H));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);   // alta definición con tope para gama baja
    canvas.style.width = Math.round(W * scale) + 'px'; canvas.style.height = Math.round(H * scale) + 'px';
    canvas.width = Math.round(W * scale * dpr); canvas.height = Math.round(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    buildFelt();
  }

  const MENU_ROWS = { y0: 250, h: 74, gap: 8 };
  const BTN = {
    sound: { x: 14, y: 600, w: 104, h: 26 },
    again: { x: 70, y: 476, w: 104, h: 40 },
    menu: { x: 186, y: 476, w: 104, h: 40 },
  };
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  function onTap(p) {
    Sfx.unlock();
    if (state === S.MENU) {
      if (inRect(p, BTN.sound)) { Sfx.toggle(); return; }
      for (let i = 0; i < CU.RIVALS.length; i++) {
        const y = MENU_ROWS.y0 + 8 + i * (MENU_ROWS.h + MENU_ROWS.gap);
        if (p.x > 20 && p.x < W - 20 && p.y > y && p.y < y + MENU_ROWS.h) { Sfx.select(); newGame(i); return; }
      }
      return;
    }
    if (state === S.JUEGO_TERMINADO && stateTime > 0.8) {
      if (inRect(p, BTN.again)) newGame(CU.RIVALS.indexOf(G.rival));
      else if (inRect(p, BTN.menu)) { G = null; setState(S.MENU); }
      return;
    }
    if (state !== S.TURNO_JUGADOR) return;
    const hit = [...G.p.hand].reverse().find((c) => Math.abs(p.x - c.x) < C.HAND_W / 2 && Math.abs(p.y - c.y) < C.HAND_H / 2 + 8);
    if (!hit) { G.selected = null; layoutHands(); return; }
    if (G.selected === hit) { playCard(G.p, hit); return; }   // segundo toque: jugar
    G.selected = hit; Sfx.select(); layoutHands();             // primer toque: elegir y ver qué levanta
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    onTap({ x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale });
  });
  window.addEventListener('keydown', (e) => {
    if (state === S.TURNO_JUGADOR && G && /^[1-5]$/.test(e.key)) {
      const c = G.p.hand[parseInt(e.key, 10) - 1]; if (c) { Sfx.unlock(); playCard(G.p, c); }
    }
  });
  window.addEventListener('resize', resize);

  // =====================================================================
  //  6. RENDER
  // =====================================================================
  let felt = null;
  function buildFelt() {   // paño pre-renderizado una sola vez (rendimiento en gama baja)
    felt = document.createElement('canvas'); felt.width = W; felt.height = H;
    const f = felt.getContext('2d');
    const g = f.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * 0.7);
    g.addColorStop(0, '#1a7a4c'); g.addColorStop(1, '#073a22');
    f.fillStyle = g; f.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { f.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`; f.fillRect(Math.random() * W, Math.random() * H, 1, 1); }
    f.strokeStyle = 'rgba(245,197,66,0.25)'; f.lineWidth = 1.5; f.setLineDash([4, 4]);
    f.strokeRect(14, TABLE_TOP - 18, W - 28, TABLE_BOTTOM - TABLE_TOP + 36);
  }

  function txt(s, x, y, size, color, align = 'center', weight = '800', stroke = true) {
    ctx.font = `${weight} ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = Math.max(2, size / 6); ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

  function suitIcon(sym, x, y, s, color) {
    ctx.fillStyle = color; ctx.strokeStyle = color;
    switch (sym) {
      case 'sol':
        ctx.beginPath(); ctx.arc(x, y, s * 0.42, 0, TAU); ctx.fill();
        ctx.lineWidth = s * 0.12;
        for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55); ctx.lineTo(x + Math.cos(a) * s * 0.85, y + Math.sin(a) * s * 0.85); ctx.stroke(); }
        break;
      case 'corazon':
        ctx.beginPath(); ctx.moveTo(x, y + s * 0.7);
        ctx.bezierCurveTo(x - s * 1.1, y - s * 0.1, x - s * 0.5, y - s * 0.9, x, y - s * 0.3);
        ctx.bezierCurveTo(x + s * 0.5, y - s * 0.9, x + s * 1.1, y - s * 0.1, x, y + s * 0.7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x - s * 0.06, y - s * 0.32, s * 0.12, s * 0.5); ctx.fillRect(x - s * 0.2, y - s * 0.2, s * 0.4, s * 0.1); // cruz de la Basílica
        break;
      case 'espada':
        ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y - s * 0.85); ctx.lineTo(x, y + s * 0.45); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - s * 0.45, y + s * 0.35); ctx.lineTo(x + s * 0.45, y + s * 0.35); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y + s * 0.72, s * 0.14, 0, TAU); ctx.fill();
        break;
      case 'campana':
        ctx.beginPath(); ctx.moveTo(x - s * 0.55, y + s * 0.45);
        ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.75, x, y - s * 0.75);
        ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.75, x + s * 0.55, y + s * 0.45); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y + s * 0.6, s * 0.16, 0, TAU); ctx.fill();
        break;
    }
  }

  function drawCardBack(x, y, w, h) {
    rr(x - w / 2, y - h / 2, w, h, 5); ctx.fillStyle = '#7b1e1e'; ctx.fill();
    ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.beginPath(); rr(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8, 3); ctx.clip();
    ctx.strokeStyle = 'rgba(245,197,66,0.45)'; ctx.lineWidth = 1;
    for (let k = -h; k < w + h; k += 7) { ctx.beginPath(); ctx.moveTo(x - w / 2 + k, y - h / 2); ctx.lineTo(x - w / 2 + k - h, y + h / 2); ctx.stroke(); }
    ctx.restore();
    suitIcon('sol', x, y, Math.min(w, h) * 0.22, '#f5c542');
  }

  function drawFigure(card, x, y, s, color) {
    // figuras quiteñas sencillas: Sota (joven con sombrero), Caballo (cabeza de caballo), Rey (corona)
    ctx.fillStyle = color;
    if (card.rank.figure === 'rey') {
      ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.4); ctx.lineTo(x - s, y - s * 0.4); ctx.lineTo(x - s * 0.5, y); ctx.lineTo(x, y - s * 0.7);
      ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x + s, y - s * 0.4); ctx.lineTo(x + s, y + s * 0.4); ctx.closePath(); ctx.fill();
    } else if (card.rank.figure === 'caballo') {
      ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.8); ctx.lineTo(x - s * 0.4, y - s * 0.3); ctx.lineTo(x - s * 0.1, y - s * 0.8);
      ctx.lineTo(x + s * 0.1, y - s * 0.5); ctx.lineTo(x + s * 0.8, y - s * 0.1); ctx.lineTo(x + s * 0.6, y + s * 0.2); ctx.lineTo(x + s * 0.1, y + s * 0.1);
      ctx.lineTo(x + s * 0.3, y + s * 0.8); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * 0.38, 0, TAU); ctx.fill();
      ctx.fillRect(x - s * 0.75, y - s * 0.5, s * 1.5, s * 0.16); ctx.fillRect(x - s * 0.38, y - s * 0.9, s * 0.76, s * 0.42);
      ctx.fillRect(x - s * 0.45, y + s * 0.3, s * 0.9, s * 0.55);
    }
  }

  function drawCard(c, w, h) {
    if (c.hidden) return;
    const x = c.x, y = c.y;
    if (!c.faceUp) { drawCardBack(x, y, w, h); return; }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    rr(x - w / 2, y - h / 2, w, h, 5); ctx.fillStyle = '#fbf6ea'; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = c.hl ? '#ffd400' : 'rgba(0,0,0,0.35)'; ctx.lineWidth = c.hl ? 3 : 1;
    rr(x - w / 2, y - h / 2, w, h, 5); ctx.stroke();
    const col = c.suit.color, s = w / 60;
    txt(c.rank.label, x - w / 2 + 9 * s, y - h / 2 + 11 * s, 15 * s, col, 'center', '900', false);
    suitIcon(c.suit.symbol, x - w / 2 + 9 * s, y - h / 2 + 25 * s, 7 * s, col);
    if (c.rank.figure) drawFigure(c, x + 3 * s, y + 4 * s, 15 * s, col);
    else suitIcon(c.suit.symbol, x + 3 * s, y + 6 * s, 16 * s, col);
    txt(c.rank.label, x + w / 2 - 9 * s, y + h / 2 - 11 * s, 15 * s, col, 'center', '900', false);
  }

  function drawPortrait(rival, x, y, s, t) {
    const k = rival.colors;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    // hombros
    ctx.fillStyle = k.coat; ctx.beginPath(); ctx.ellipse(0, 26, 24, 14, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = k.trim; ctx.fillRect(-3, 13, 6, 12);
    if (rival.id === 'gallo') {
      ctx.fillStyle = k.coat; ctx.beginPath(); ctx.ellipse(0, -2, 15, 17, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c0392b'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 5, -20 - Math.abs(i) * -2, 5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#f39c12'; ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(22, 1); ctx.lineTo(10, 4); ctx.fill();
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.ellipse(11, 9, 3, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(5, -6, 2.2, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = k.skin; ctx.beginPath(); ctx.ellipse(0, -2, 13, 15, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-5, -4, 1.8, 0, TAU); ctx.arc(5, -4, 1.8, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 4, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      if (rival.id === 'chulla') {
        ctx.fillStyle = '#1b1b1b'; ctx.fillRect(-5, 0, 10, 2);                      // bigote
        ctx.fillStyle = k.hat; ctx.fillRect(-19, -16, 38, 4); ctx.fillRect(-11, -28, 22, 13);
        ctx.fillStyle = k.trim; ctx.fillRect(-11, -18, 22, 3);
      } else if (rival.id === 'almeida') {
        ctx.fillStyle = k.coat; ctx.beginPath(); ctx.arc(0, -4, 18, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(16, 12); ctx.lineTo(-16, 12); ctx.fill();
        ctx.fillStyle = k.skin; ctx.beginPath(); ctx.ellipse(0, -1, 11, 13, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-4, -3, 1.8, 0, TAU); ctx.arc(4, -3, 1.8, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#3b2412'; ctx.beginPath(); ctx.arc(0, 4, 4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      } else if (rival.id === 'cantuna') {
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(-16, -28 - Math.sin(t * 3)); ctx.lineTo(-5, -15); ctx.fill();
        ctx.beginPath(); ctx.moveTo(10, -12); ctx.lineTo(16, -28 - Math.sin(t * 3)); ctx.lineTo(5, -15); ctx.fill();
        ctx.fillStyle = '#ffcf33'; ctx.beginPath(); ctx.arc(-5, -4, 1.6, 0, TAU); ctx.arc(5, -4, 1.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a0505'; ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(0, 17); ctx.lineTo(4, 9); ctx.fill();  // barba
      }
    }
    ctx.restore();
  }

  function drawScene(rival, t) {
    const sc = rival.scene;
    const g = ctx.createLinearGradient(0, 0, 0, 92); g.addColorStop(0, sc.sky[0]); g.addColorStop(1, sc.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 92);
    // siluetas de la ciudad según el escenario
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    if (rival.id === 'chulla') { for (let x = 0; x < W; x += 44) { ctx.fillRect(x, 50, 40, 42); ctx.fillStyle = 'rgba(255,200,80,0.6)'; ctx.fillRect(x + 8, 62, 8, 10); ctx.fillRect(x + 24, 62, 8, 10); ctx.fillStyle = 'rgba(0,0,0,0.55)'; } }
    if (rival.id === 'gallo') { ctx.fillRect(60, 44, 240, 48); ctx.beginPath(); ctx.moveTo(150, 44); ctx.lineTo(180, 20); ctx.lineTo(210, 44); ctx.fill(); ctx.fillRect(176, 8, 8, 14); }
    if (rival.id === 'almeida') { ctx.fillRect(40, 52, 280, 40); for (let x = 50; x < 320; x += 30) { ctx.fillStyle = 'rgba(20,30,60,0.9)'; ctx.beginPath(); ctx.arc(x + 12, 70, 9, Math.PI, TAU); ctx.fillRect(x + 3, 70, 18, 22); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; } }
    if (rival.id === 'cantuna') { ctx.fillRect(70, 40, 220, 52); ctx.fillRect(84, 18, 26, 26); ctx.fillRect(250, 18, 26, 26); ctx.beginPath(); ctx.moveTo(84, 18); ctx.lineTo(97, 4); ctx.lineTo(110, 18); ctx.moveTo(250, 18); ctx.lineTo(263, 4); ctx.lineTo(276, 18); ctx.fill(); }
    // banderines de fiesta
    const cols = ['#c0392b', '#2e86c1', '#f1c40f', '#ffffff'];
    for (let k = 0; k < 16; k++) { const x = 8 + k * 23, y = 6 + Math.sin(k / 15 * Math.PI) * 8; ctx.fillStyle = cols[k % 4]; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x + Math.sin(t * 3 + k) * 1.5, y + 11); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 92, W, 2);
  }

  function drawScore(who, x, y, align, label) {
    txt(label, x, y, 11, 'rgba(255,255,255,0.85)', align, '700');
    txt(String(who.score), x, y + 20, 22, who.score >= 38 ? '#ffb3a1' : '#ffe066', align, '900');
    // rayas: cada raya = 2 puntos, en grupos de cinco
    const rayas = Math.floor(who.score / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < rayas; i++) {
      const grp = Math.floor(i / 5), k = i % 5, dir = align === 'left' ? 1 : -1;
      const bx = x + dir * (34 + grp * 18), by = y + 22;
      if (k < 4) { ctx.beginPath(); ctx.moveTo(bx + dir * k * 3.5, by - 7); ctx.lineTo(bx + dir * k * 3.5, by + 7); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(bx - dir * 2, by + 6); ctx.lineTo(bx + dir * 13, by - 6); ctx.stroke(); }
    }
  }

  function drawPile(n, p, label) {
    if (n > 0) for (let i = 0; i < Math.min(5, Math.ceil(n / 4)); i++) drawCardBack(p.x + i * 1.2, p.y - i * 1.6, 36, 52);
    txt(label + ' ' + n, p.x, p.y + 36, 10, '#fff', 'center', '700');
  }

  function drawPreview() {
    if (!G.selected || state !== S.TURNO_JUGADOR) return;
    const lastByA = G.lastBy === G.a ? G.last : null;
    const cap = Rules.findCapture(G.selected, G.table, lastByA);
    for (const c of G.table) c.hl = cap ? cap.taken.includes(c) : false;
    let msg = 'Se queda en la mesa', col = 'rgba(255,255,255,0.85)';
    if (cap) {
      const pts = Rules.playPoints(cap, G.p.score);
      msg = 'Levanta ' + (cap.taken.length + 1) + (pts.caida ? ' · CAÍDA +2' : '') + (pts.limpia ? ' · LIMPIA +2' : '') + (pts.limpiaAnulada ? ' · (limpia no vale en 38)' : '');
      col = pts.points ? '#ffe066' : '#bff5c9';
    }
    txt(msg, W / 2, 470, 11.5, col, 'center', '800');
    txt('Toca otra vez para jugar', W / 2, 488, 9, 'rgba(255,255,255,0.7)', 'center', '600', false);
  }

  function drawGame(t) {
    ctx.drawImage(felt, 0, 0, W, H);
    drawScene(G.rival, t);
    drawPortrait(G.rival, 36, 120, 1, t);
    txt(G.rival.name, 74, 104, 11, '#fff', 'left', '800');
    txt(G.rival.place, 74, 118, 8.5, 'rgba(255,255,255,0.75)', 'left', '600', false);
    drawScore(G.a, W - 16, 100, 'right', 'Rival');
    // mazo
    if (G.deck.length) { for (let i = 0; i < Math.min(6, Math.ceil(G.deck.length / 6)); i++) drawCardBack(DECK_POS.x + i, DECK_POS.y - i * 1.5, 40, 58); txt(String(G.deck.length), DECK_POS.x, DECK_POS.y + 40, 10, '#fff', 'center', '700'); }
    drawPile(G.a.pile.length, PILE_A, 'Cartón');
    drawPile(G.p.pile.length, PILE_P, 'Cartón');
    if (G.selected && state === S.TURNO_JUGADOR) drawPreview(); else if (state !== S.VALIDAR_JUGADA) for (const c of G.table) c.hl = false;
    for (const c of G.table) drawCard(c, C.CARD_W, C.CARD_H);
    for (const c of G.a.hand) drawCard(c, 44, 62);
    for (const c of [...G.p.pile, ...G.a.pile]) if (!c.hidden) drawCard(c, C.CARD_W, C.CARD_H);
    if (G.play && !G.table.includes(G.play.card) && !G.p.pile.includes(G.play.card) && !G.a.pile.includes(G.play.card)) drawCard(G.play.card, C.CARD_W, C.CARD_H);
    for (const c of G.p.hand) drawCard(c, C.HAND_W, C.HAND_H);
    drawScore(G.p, 16, 590, 'left', 'Tú');
    // turno
    if (state === S.TURNO_JUGADOR && !G.selected) txt('Tu turno: elige una carta', W / 2, 478, 12, '#ffe066', 'center', '800');
    if (state === S.TURNO_IA) txt(G.rival.name + ' piensa…', W / 2, 196, 10.5, 'rgba(255,255,255,0.85)', 'center', '700');
    txt((G.dealerIsP ? 'Das tú' : 'Da ' + G.rival.name.split(' ').slice(-1)[0]) + ' · Mazo ' + G.deckNo, W - 14, 622, 8.5, 'rgba(255,255,255,0.6)', 'right', '600', false);
    // globo de diálogo
    if (G.bubble) {
      const a = clamp(G.bubble.life / 0.4, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = '700 11px system-ui, sans-serif';
      const w = Math.min(250, ctx.measureText(G.bubble.text).width + 20);
      rr(64, 54, w, 26, 10); ctx.fillStyle = '#fffaf0'; ctx.fill();           // sobre la escena, junto al retrato
      ctx.beginPath(); ctx.moveTo(70, 78); ctx.lineTo(48, 96); ctx.lineTo(84, 78); ctx.fill();
      txt(G.bubble.text, 64 + w / 2, 67, 11, '#3b2412', 'center', '700', false);
      ctx.globalAlpha = 1;
    }
    if (state === S.CONTEO_CARTON) drawCarton();
    if (state === S.JUEGO_TERMINADO) drawGameOver(t);
  }

  function drawCarton() {
    const K = G.carton;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(30, 220, W - 60, 200);
    ctx.strokeStyle = '#f5c542'; ctx.strokeRect(30.5, 220.5, W - 61, 199);
    txt(CU.TEXT.carton, W / 2, 244, 17, '#ffe066');
    txt('Tú: ' + K.shownP + ' cartas', W / 2, 282, 14, '#fff', 'center', '700');
    txt(G.rival.name + ': ' + K.shownA + ' cartas', W / 2, 308, 14, '#fff', 'center', '700');
    if (K.applied) {
      const r = K.res;
      const msg = r.tie ? (CU.TEXT.dosPorDar + ': +' + (r.a || r.b) + (r.a ? ' para ti' : ' para el rival'))
        : r.a ? '¡Cartón para ti! +' + r.a : r.b ? 'Cartón para el rival +' + r.b : 'El cartón no suma (regla de 38)';
      txt(msg, W / 2, 350, 15, '#ffe066');
      txt('Nuevo mazo…', W / 2, 390, 10, 'rgba(255,255,255,0.7)', 'center', '600', false);
    }
  }

  function wrapLines(text, maxW, font) {
    ctx.font = font; const out = []; let cur = '';
    for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }

  function button(r, label, primary) {
    rr(r.x, r.y, r.w, r.h, 8); ctx.fillStyle = primary ? '#d4a72c' : 'rgba(255,255,255,0.12)'; ctx.fill();
    ctx.strokeStyle = primary ? '#d4a72c' : 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    txt(label, r.x + r.w / 2, r.y + r.h / 2, 12, primary ? '#2b1a08' : '#fff', 'center', '800', false);
  }

  function drawGameOver(t) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
    const pWon = G.winner === G.p;
    drawPortrait(G.rival, W / 2, 230, 1.8, t);
    txt(pWon ? CU.TEXT.youWin : CU.TEXT.youLose, W / 2, 320, 26, pWon ? '#ffe066' : '#ff9f8f');
    txt(G.p.score + '  –  ' + G.a.score, W / 2, 356, 20, '#fff');
    if (G.bubble) txt('«' + G.bubble.text + '»', W / 2, 392, 12, '#fbf3e4', 'center', '600', false);
    wrapLines(G.rival.legend, 300, '500 9.5px system-ui, sans-serif').slice(0, 3).forEach((ln, i) => txt(ln, W / 2, 410 + i * 14, 9.5, 'rgba(255,255,255,0.75)', 'center', '500', false));
    if (stateTime > 0.8) { button(BTN.again, 'Revancha', true); button(BTN.menu, 'Menú', false); }
  }

  function drawMenu(t) {
    ctx.drawImage(felt, 0, 0, W, H);
    const cols = ['#c0392b', '#2e86c1', '#f1c40f', '#ffffff'];
    for (let k = 0; k < 16; k++) { const x = 8 + k * 23, y = 6 + Math.sin(k / 15 * Math.PI) * 10; ctx.fillStyle = cols[k % 4]; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x + Math.sin(t * 3 + k) * 1.5, y + 12); ctx.fill(); }
    txt('CUARENTA', W / 2, 74, 46, '#f5c542');
    txt('El Juicio de las Leyendas', W / 2, 112, 17, '#fbf3e4', 'center', '700');
    txt(CU.TEXT.tagline, W / 2, 136, 10, 'rgba(251,243,228,0.8)', 'center', '600', false);
    // abanico de cartas decorativo
    const fan = [CU.RANKS[0], CU.RANKS[6], CU.RANKS[9], CU.RANKS[7]];
    fan.forEach((r, i) => {
      ctx.save(); ctx.translate(W / 2 + (i - 1.5) * 26, 196); ctx.rotate((i - 1.5) * 0.18);
      drawCard({ x: 0, y: 0, faceUp: true, rank: r, suit: CU.SUITS[i] }, 46, 66); ctx.restore();
    });
    txt('Elige tu rival', W / 2, 240, 12, '#f5c542', 'center', '800');
    CU.RIVALS.forEach((rv, i) => {
      const y = MENU_ROWS.y0 + 8 + i * (MENU_ROWS.h + MENU_ROWS.gap);
      rr(20, y, W - 40, MENU_ROWS.h, 10); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      ctx.strokeStyle = 'rgba(245,197,66,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      drawPortrait(rv, 56, y + MENU_ROWS.h / 2, 0.95, t + i);
      txt(rv.name, 96, y + 18, 13, '#fff', 'left', '800');
      txt(rv.place, 96, y + 34, 9.5, '#ffe9a8', 'left', '700', false);
      txt('★'.repeat(rv.difficulty) + '☆'.repeat(4 - rv.difficulty), W - 30, y + 18, 11, '#f5c542', 'right', '700', false);
      let wins = 0; try { wins = parseInt(localStorage.getItem('cu.wins.' + rv.id), 10) || 0; } catch { /* */ }
      txt(wins ? 'Le ganaste ' + wins + (wins === 1 ? ' vez' : ' veces') : '«' + rv.phrases.hello[0] + '»', 96, y + 54, 8.5, 'rgba(255,255,255,0.75)', 'left', '600', false);
    });
    button(BTN.sound, Sfx.isMuted() ? 'Sonido: NO' : 'Sonido: SÍ', false);
    txt('v' + CU.META.version + ' | Desarrollado por ' + CU.META.author, W - 12, 628, 7.5, 'rgba(251,243,228,0.55)', 'right', '500', false);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (state === S.MENU || !G) drawMenu(simTime); else drawGame(simTime);
    for (const f of fx) { ctx.globalAlpha = clamp(f.life / 0.5, 0, 1); txt(f.text, f.x, f.y, f.size, f.color); ctx.globalAlpha = 1; }
  }

  // =====================================================================
  //  7. BUCLE: requestAnimationFrame + acumulador a 60 Hz fijos
  // =====================================================================
  let last = performance.now(), acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let n = 0;
    while (acc >= C.STEP && n < 8) { update(C.STEP); acc -= C.STEP; n++; }
    if (n === 8) acc = 0;
    render();
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame((t) => { last = t; frame(t); });

  // Gancho para pruebas automatizadas.
  CU._debug = { S, get state() { return state; }, get game() { return G; }, get frames() { return frames; }, newGame, playCard, aiChoose, setState };
})(window.CU);
