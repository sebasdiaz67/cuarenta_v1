/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: js/game.js — Reglas del Cuarenta, IA, máquina de estados, entrada, composición de pantallas y bucle
 * Depende de: config.js → rules.js → audio.js → draw.js → net.js (cargados antes en index.html)
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.9.0
 */
(function (CU) {
  'use strict';
  const C = CU.CFG, R = CU.RULES, W = C.W, H = C.H, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const ease = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);

  // =====================================================================
  //  1. REGLAS → js/rules.js (compartidas con el servidor online)
  // =====================================================================
  const Rules = CU.Rules;

  // =====================================================================
  //  2. SONIDO Y MÚSICA → js/audio.js (CU.Audio). Alias local para no tocar las llamadas.
  // =====================================================================
  const Sfx = CU.Audio;

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
    MENU: 'MENU', MENU_IA: 'MENU_IA', LOBBY: 'LOBBY',
    REPARTIR_CARTAS: 'REPARTIR_CARTAS', TURNO_JUGADOR: 'TURNO_JUGADOR', TURNO_IA: 'TURNO_IA',
    TURNO_RIVAL_RED: 'TURNO_RIVAL_RED',   // online: congelado esperando la jugada del amigo (evento del servidor)
    ESPERA_RED: 'ESPERA_RED',             // online: entre eventos del servidor
    VALIDAR_JUGADA: 'VALIDAR_JUGADA', CONTEO_CARTON: 'CONTEO_CARTON',
    FIN_CHICA: 'FIN_CHICA',               // terminó una chica; la partida sigue (a 2 de 3, manual §2)
    JUEGO_TERMINADO: 'JUEGO_TERMINADO',
  };
  let state = S.MENU, stateTime = 0, simTime = 0, frames = 0;
  let G = null;            // partida
  const fx = [];           // textos y partículas
  let menuHover = -1;

  // Modo de asistencia (spec 008): Aprendizaje = con pistas (vista previa de la jugada);
  // Experto = sin pistas. Es preferencia local del cliente (no se envía al servidor) y persiste.
  let assist = (() => { try { return localStorage.getItem('cu.assist') !== '0'; } catch { return true; } })();
  function setAssist(v) { assist = !!v; try { localStorage.setItem('cu.assist', assist ? '1' : '0'); } catch { /* localStorage no disponible */ } }

  function setState(s) { state = s; stateTime = 0; }

  function newGame(rivalIndex) {
    const rival = CU.RIVALS[rivalIndex];
    G = {
      rival, deck: [], table: [], seen: [],
      p: { name: 'Tú', hand: [], pile: [], score: 0 },
      a: { name: rival.name, hand: [], pile: [], score: 0 },
      dealerIsP: Math.random() < 0.5, turnP: true, lastPlayedCard: null, lastPlayedBy: null, lastCapturer: null,
      selected: null, play: null, bubble: null, winner: null, carton: null, dealt: 0, deckNo: 0,
      chicas: { p: 0, a: 0 }, chicaNo: 1, streak: [0, 0], winReason: null, chicaResult: null,
    };
    Imps.clear(); flyers.length = 0;
    say('hello');
    newDeck();
  }

  // =====================================================================
  //  4b. MODO ONLINE — el servidor es el árbitro; aquí solo se animan sus eventos
  // =====================================================================
  const TEMPLATE = new Map(Rules.makeDeck().map((c) => [c.id, c]));
  const mkCard = (id) => { const t = TEMPLATE.get(id); return { id, rank: t.rank, suit: t.suit }; };
  const mkHidden = () => ({ id: '?', rank: null, suit: null, faceUp: false });   // carta del rival: solo el reverso
  const netQueue = [];

  function newOnlineGame() {
    G = {
      rival: CU.ONLINE_RIVAL, online: true, deck: [], table: [], seen: [],
      p: { name: 'Tú', hand: [], pile: [], score: 0 },
      a: { name: CU.ONLINE_RIVAL.name, hand: [], pile: [], score: 0 },
      dealerIsP: false, turnP: false, lastPlayedCard: null, lastPlayedBy: null, lastCapturer: null,
      selected: null, play: null, bubble: null, winner: null, carton: null, deckNo: 0,
      chicas: { p: 0, a: 0 }, chicaNo: 1, streak: [0, 0], winReason: null, chicaResult: null,
    };
    netQueue.length = 0; Imps.clear(); flyers.length = 0; fx.length = 0;
    setState(S.ESPERA_RED);
  }
  CU.Net.onStart = () => { CU.Lobby.close(); newOnlineGame(); Sfx.startBGM(); };   // «Jugar» online
  CU.Net.onEvent = (e) => { if (G && G.online) netQueue.push(e); };
  CU.Lobby.onBack = () => { G = null; setState(S.MENU); };

  // El cliente procesa un evento solo cuando no está animando (las animaciones duran más que la red).
  function netIdle() {
    return state === S.ESPERA_RED || state === S.TURNO_JUGADOR || state === S.TURNO_RIVAL_RED
      || (state === S.VALIDAR_JUGADA && G.play && G.play.phase === 'await');
  }
  function processNet() {
    while (G && G.online && netQueue.length && netIdle()) handleNet(netQueue.shift());
  }
  const whoOf = (w) => (w === 'you' ? G.p : G.a);
  function setScores(sc) { G.p.score = sc.you; G.a.score = sc.rival; }

  function handleNet(e) {
    switch (e.type) {
      case 'deal': {
        if (e.deckNo !== G.deckNo) {                                       // mazo nuevo
          G.table = []; G.p.pile = []; G.a.pile = []; G.p.hand = []; G.a.hand = []; G.seen = []; G.lastCapturer = null; G.deckNo = e.deckNo;
        }
        if (!R.CAIDA_ENTRE_REPARTOS) clearLastPlayed();
        G.dealerIsP = e.dealerIsYou;
        const mano = G.dealerIsP ? G.a : G.p, otro = mano === G.p ? G.a : G.p;
        const mine = e.hand.map(mkCard);
        G.dealQueue = [];
        for (const who of [mano, otro]) for (let i = 0; i < 5; i++) G.dealQueue.push({ who, card: who === G.p ? mine[i] : mkHidden() });
        G.deck = new Array(e.deckCount + G.dealQueue.length).fill(null);  // solo para mostrar cuántas quedan
        G.dealTimer = 0;
        Sfx.playBarajear();
        setState(S.REPARTIR_CARTAS);
        break;
      }
      case 'ronda': {
        const who = whoOf(e.who), before = who.score;
        setScores(e.scores);
        if (e.kind === 'cuatro') { popup(CU.TEXT.cuatro, W / 2, 330, '#ffe066', 26); break; }   // le sigue gameOver
        flyPoints(who, before);
        popup(CU.TEXT.ronda + (e.points ? ' +' + e.points : ''), W / 2, who === G.p ? 440 : 230, '#ffe066', 26);
        Sfx.ronda();
        break;
      }
      case 'turn':
        setState(e.yourTurn ? S.TURNO_JUGADOR : S.TURNO_RIVAL_RED);
        break;
      case 'played': {
        if (e.by === 'rival') {
          const slot = G.a.hand[0] || mkHidden(), card = mkCard(e.card);
          card.x = slot.x; card.y = slot.y;                               // sale desde el reverso que tenía el rival
          G.a.hand[0] = card;
          playCard(G.a, card);
          G.play.net = e;
        } else if (G.play && G.play.card.id === e.card) {
          G.play.net = e; G.play.phase = 'resolve'; resolvePlay();
        }
        break;
      }
      case 'carton': {
        const to = e.sobrantesTo ? whoOf(e.sobrantesTo) : null;
        if (to) {
          const pile = to === G.p ? PILE_P : PILE_A;
          for (const c of G.table.filter((c) => e.sobrantes.includes(c.id))) { to.pile.push(c); moveTo(c, pile.x, pile.y, 0.5); c.toPile = true; }
          G.table = G.table.filter((c) => !e.sobrantes.includes(c.id));
        }
        const side = (w) => (w === 'you' ? 'a' : w === 'rival' ? 'b' : null);
        if (!e.sobrantesTo && G.table.length) popup(CU.TEXT.retiradas, W / 2, 200, '#fbf3e4', 12);
        G.carton = { nP: e.you, nA: e.rival, net: e, shownP: 0, shownA: 0, applied: false,
          res: { a: e.add.you, b: e.add.rival, tie: e.tie, carton: side(e.cartonTo), dosPorDar: side(e.dosPorDar), falla: side(e.falla) } };
        setState(S.CONTEO_CARTON);
        break;
      }
      case 'chicaOver':
      case 'gameOver': {
        setScores(e.scores);
        const who = whoOf(e.winner);
        G.chicas = { p: e.chicas.you, a: e.chicas.rival };
        G.chicaResult = { who, reason: e.reason, zap: e.zapateria ? whoOf(e.zapateria) : null };
        if (e.reason === 'caidas') popup('¡4 CAÍDAS SEGUIDAS!', W / 2, 300, '#ffe066', 22);
        if (e.type === 'gameOver') { G.winner = who; endGame(); } else showChica(who);
        break;
      }
      case 'rivalLeft':
      case 'disconnected':
        if (state === S.JUEGO_TERMINADO) break;
        G.abandoned = e.type === 'rivalLeft' ? 'Tu amigo salió de la mesa' : 'Se perdió la conexión con el servidor';
        G.winner = null;                                  // nadie gana una chica que no se terminó
        endGame();
        break;
    }
  }

  function newDeck() {
    G.deck = Rules.shuffle(Rules.makeDeck());
    G.table = []; G.seen = []; G.p.pile = []; G.a.pile = []; G.lastPlayedCard = null; G.lastPlayedBy = null; G.lastCapturer = null; G.play = null; G.selected = null;
    G.dealerIsP = !G.dealerIsP; G.deckNo++;
    startDeal();
  }

  // Última carta lanzada por `who` que sigue en la mesa (candidata a caída del otro), o null.
  function lastPlayedBy(who) { return G.lastPlayedBy === who && G.table.includes(G.lastPlayedCard) ? G.lastPlayedCard : null; }
  function clearLastPlayed() { G.lastPlayedCard = null; G.lastPlayedBy = null; }

  function startDeal() {
    Sfx.playBarajear();                                      // sonido de barajear al empezar cada reparto
    G.dealQueue = [];
    if (!R.CAIDA_ENTRE_REPARTOS) clearLastPlayed();       // cada mano empieza sin caída pendiente
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

  // Lanzamiento flotante: Lerp de la posición actual al destino; la carta se inclina según la dirección
  // del vuelo y se endereza al llegar. Movimientos cortos (reacomodos) no se inclinan.
  function moveTo(card, x, y, dur) {
    const dx = x - (card.x || 0), dy = y - (card.y || 0);
    const tilt = Math.hypot(dx, dy) > 40 ? Math.sign(dx || 1) * C.CARD_TILT : 0;
    card.targetX = x; card.targetY = y;                    // destino; (x, y) es la posición actual
    card.anim = { fromX: card.x, fromY: card.y, t: 0, dur, tilt };
  }
  const lerp = (a, b, p) => a + (b - a) * p;
  function layoutTable() { G.table.forEach((c, i) => { const p = tablePos(i, G.table.length); moveTo(c, p.x, p.y, 0.2); }); }
  function layoutHands(dur = 0.15) {
    G.p.hand.forEach((c, i) => { const p = handPos(i, G.p.hand.length); moveTo(c, p.x, p.y - (c === G.selected ? 16 : 0), dur); });
    G.a.hand.forEach((c, i) => { const p = aiHandPos(i, G.a.hand.length); moveTo(c, p.x, p.y, dur); });
  }

  // ------------------------------------------------------------------ textos y frases
  // ------------------------------------------------------------------ diablillos (solo contra Cantuña)
  const AMBIENT_ZONE = { x: 0, y: 40, w: W, h: 52 };      // franja del atrio, bajo los banderines
  const isDevil = () => G && G.rival.id === 'cantuna';

  // ------------------------------------------------------------------ perros y tantos que vuelan al marcador
  // Al sumar, aparece una carta de puntos grande (se lee la frase del tanto) y luego se desliza (Lerp)
  // encogiéndose hasta el marcador. Perro si se cruzó una decena; si no, tanto.
  const flyers = [];
  const FLY = { HOLD: 0.55, DUR: 0.35, BIG_W: 58, BIG_H: 82, SMALL_W: 15, SMALL_H: 21, START: { x: W / 2, y: 398 } };
  function flyPoints(who, before) {
    if (who.score <= before) return;
    const kind = Math.floor(who.score / 10) > Math.floor(before / 10) ? 'perro' : 'tanto';
    if (kind === 'perro') Sfx.playPerro();                 // se completó una decena: ladrido
    const t = who === G.p ? { x: 16 + 46, y: 612 } : { x: W - 16 - 46, y: 122 };
    flyers.push({ kind, x: FLY.START.x, y: FLY.START.y, tx: t.x, ty: t.y, t: 0 });
  }
  function updateFlyers(dt) {
    for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.t += dt; if (f.t >= FLY.HOLD + FLY.DUR) flyers.splice(i, 1); }
  }
  function drawFlyers() {
    for (const f of flyers) {
      const pop = Math.min(1, f.t / 0.12), k = clamp((f.t - FLY.HOLD) / FLY.DUR, 0, 1);
      const x = lerp(FLY.START.x, f.tx, k), y = lerp(FLY.START.y, f.ty, k);
      const w = lerp(FLY.BIG_W, FLY.SMALL_W, k) * (0.6 + 0.4 * pop), h = lerp(FLY.BIG_H, FLY.SMALL_H, k) * (0.6 + 0.4 * pop);
      D.drawPointCard(f.kind, x, y, w, h, FLY.BIG_W, FLY.BIG_H);     // un sprite grande, reescalado
    }
  }

  function popup(text, x, y, color, size = 28) { fx.push({ type: 'text', text, x, y, color, size, life: 1.6, max: 1.6 }); }
  function say(kind) {
    const list = G.rival.phrases[kind]; if (!list || !list.length) return;
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

  // Resultado de la jugada: con la IA lo calculan las reglas locales; online lo dicta el servidor.
  function judge(card, other) {
    const n = G.play.net;
    if (!n) return Rules.findCapture(card, G.table, lastPlayedBy(other));
    if (!n.capture) return null;
    return { kind: n.capture.kind, taken: n.capture.taken.map((id) => G.table.find((c) => c.id === id)).filter(Boolean), caida: n.caida, limpia: n.limpia };
  }

  function resolvePlay() {
    const { who, card, isP } = G.play;
    const other = isP ? G.a : G.p;
    const cap = judge(card, other);
    G.seen.push(card);
    if (!cap) {
      if (!G.play.net) Rules.caidaStreak(G.streak, isP ? 0 : 1, false);   // jugar sin caída corta la racha
      G.table.push(card);
      G.lastPlayedCard = card; G.lastPlayedBy = who;        // se queda en la mesa: el rival puede hacerle caída
      layoutTable();
      G.play.phase = 'done'; G.play.t = 0;
      return;
    }
    const n = G.play.net;
    const pts = n ? { points: n.points, caida: n.caida, limpia: n.limpia, limpiaAnulada: n.limpiaAnulada } : Rules.playPoints(cap, who.score);
    G.play.cap = cap; G.play.pts = pts;
    G.table.push(card);
    G.play.taking = [card, ...cap.taken];
    for (const c of G.play.taking) c.hl = true;
    G.play.phase = 'highlight'; G.play.t = 0;
    const before = who.score;
    if (n) setScores(n.scores); else who.score += pts.points;
    if (!n && Rules.caidaStreak(G.streak, isP ? 0 : 1, !!pts.caida)) {   // manual §15B: 4 caídas seguidas
      who.score = Math.max(who.score, R.WIN_POINTS); G.winReason = 'caidas';
      popup('¡4 CAÍDAS SEGUIDAS!', W / 2, (TABLE_TOP + TABLE_BOTTOM) / 2 + 40, '#ffe066', 22);
    }
    flyPoints(who, before);
    const cx = W / 2, cy = (TABLE_TOP + TABLE_BOTTOM) / 2;
    if (pts.caida && pts.limpia) { popup('¡CAÍDA Y LIMPIA!', cx, cy, '#ffe066', 26); Sfx.playCaidaYLimpia(); }   // látigo + risa
    else if (pts.caida) { popup(CU.TEXT.caida, cx, cy, '#ffe066', 34); Sfx.playCaida(); }                     // látigo
    else if (pts.limpia) { popup(CU.TEXT.limpia, cx, cy, '#9be7ff', 34); Sfx.limpia(); }
    else Sfx.capture();
    if (pts.limpiaAnulada) popup(CU.TEXT.regla38, cx, cy + 34, '#ffb3a1', 13);
    if (!isP && (pts.caida || pts.limpia)) say(pts.caida ? 'caida' : 'limpia');
    if (!isP && isDevil()) {
      if (pts.caida || pts.limpia) { Imps.burst(cx, cy, C.IMPS.BURST_IMPS, C.IMPS.BURST_SPARKS); if (!(pts.caida && pts.limpia)) Sfx.devil(); }   // la caída+limpia ya trae su risa
      else Imps.burst(card.x, card.y, 0, 10);              // cualquier levantada del Diablo chisporrotea
    }
    if (isP && pts.caida) say('suffer');
    G.lastCapturer = who;
    clearLastPlayed();                                     // levantó (incluye la limpia): no hay caída posible
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
    if (G.online) { setState(S.ESPERA_RED); return; }   // el servidor decide: turno, reparto, cartón o fin
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
    finishChica(pW ? G.p : G.a, G.winReason || 'cuarenta');
    return true;
  }

  // ------------------------------------------------------------------ chicas (partida a 2 de 3, manual §2/§15)
  function finishChica(who, reason) {
    G.chicas[who === G.p ? 'p' : 'a']++;
    const loser = who === G.p ? G.a : G.p;
    G.chicaResult = { who, reason, zap: Rules.zapateria(loser.score) ? loser : null };
    if (G.chicas[who === G.p ? 'p' : 'a'] >= R.CHICAS_PARA_GANAR) { G.winner = who; endGame(); return; }
    showChica(who);
  }
  function showChica(who) {
    fx.length = 0; flyers.length = 0;
    G.play = null; G.selected = null;
    say(who === G.p ? 'lose' : 'win');
    if (who === G.p) Sfx.ronda(); else Sfx.lose();
    setState(S.FIN_CHICA);
  }
  function nextChica() {                                   // local: nueva chica, mismo rival
    G.p.score = 0; G.a.score = 0; G.p.hand = []; G.a.hand = []; G.play = null; G.selected = null;
    G.streak = [0, 0]; G.said38 = false; G.winReason = null; G.chicaNo++;
    newDeck();
  }

  function endGame() {
    fx.length = 0; flyers.length = 0;    // sin avisos flotando sobre la pantalla final
    setState(S.JUEGO_TERMINADO);
    const pWon = G.winner === G.p;
    Sfx.stopBGM();                       // la fanfarria de victoria/derrota no compite con la banda
    Imps.clear();
    if (isDevil() && !pWon) Imps.burst(W / 2, 250, 10, 40);
    if (pWon && !G.abandoned) D.Victory.start(); else D.Victory.stop();   // confeti solo en la victoria del jugador
    say(pWon ? 'lose' : 'win');
    if (G.abandoned && !G.winner) { /* interrumpida: sin fanfarria */ } else if (pWon) Sfx.win(); else Sfx.lose();
    if (G.online) return;
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
    } else if (G.table.length) popup(CU.TEXT.retiradas, W / 2, 200, '#fbf3e4', 12);   // §10: no cuentan para nadie
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
    Imps.update(dt);
    updateFlyers(dt);
    D.Victory.update(dt);
    if (!G) return;
    processNet();
    if (isDevil() && state !== S.JUEGO_TERMINADO) Imps.emit(dt, AMBIENT_ZONE, C.IMPS.AMBIENT_IMPS, C.IMPS.AMBIENT_SPARKS);
    if (G.bubble) { G.bubble.life -= dt; if (G.bubble.life <= 0) G.bubble = null; }
    for (const c of allCards()) {
      if (!c.anim) continue;
      c.anim.t += dt;
      const k = clamp(c.anim.t / c.anim.dur, 0, 1), p = C.CARD_EASE === 'linear' ? k : ease(k);
      c.x = lerp(c.anim.fromX, c.targetX, p); c.y = lerp(c.anim.fromY, c.targetY, p);
      c.rot = c.anim.tilt * Math.sin(Math.PI * k);          // sube y baja: se endereza al aterrizar
      if (k >= 1) { c.anim = null; c.rot = 0; if (c.toPile) c.hidden = true; }
    }

    switch (state) {
      case S.REPARTIR_CARTAS: {
        G.dealTimer -= dt;
        if (G.dealQueue.length && G.dealTimer <= 0) {
          let who, c;
          if (G.online) { ({ who, card: c } = G.dealQueue.shift()); G.deck.pop(); }
          else { who = G.dealQueue.shift(); c = G.deck.pop(); }
          c.x = DECK_POS.x; c.y = DECK_POS.y; c.faceUp = who === G.p; c.hidden = false; c.toPile = false;
          who.hand.push(c);
          layoutHands(C.ANIM_DEAL);                         // la carta vuela desde el mazo
          Sfx.deal();
          G.dealTimer = C.DEAL_GAP;
        }
        if (!G.dealQueue.length && G.dealTimer <= -Math.min(0.35, C.HIGHLIGHT)) {
          if (G.online) { setState(S.ESPERA_RED); break; }   // la ronda y el turno los anuncia el servidor
          // ronda / cuatro iguales
          for (const who of [G.p, G.a]) {
            const r = Rules.checkRonda(who.hand, who.score);
            if (!r) continue;
            if (r.type === 'cuatro') { popup(CU.TEXT.cuatro, W / 2, 330, '#ffe066', 26); who.score = Math.max(who.score, R.WIN_POINTS); finishChica(who, 'cuatro'); return; }
            const before = who.score;
            who.score += r.points;
            flyPoints(who, before);
            if (who === G.a && isDevil() && r.points) Imps.burst(W / 2, 230, 4, 20);
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
            last: lastPlayedBy(G.p), myScore: G.a.score, myHand: G.a.hand,
            seen: G.seen, memory: G.rival.style.memory, oppHandSize: G.p.hand.length,
          });
          playCard(G.a, card);
        }
        break;
      }
      case S.VALIDAR_JUGADA: {
        const P = G.play; P.t += dt;
        if (P.phase === 'move' && P.t >= C.ANIM_PLAY) {
          if (G.online && !P.net) P.phase = 'await';                // la carta ya está en la mesa; falta el veredicto
          else { P.phase = 'resolve'; resolvePlay(); }
        }
        else if (P.phase === 'highlight' && P.t >= C.HIGHLIGHT) { P.phase = 'collect'; P.t = 0; finishCapture(); }
        else if (P.phase === 'collect' && P.t >= C.ANIM_CAPTURE) { P.phase = 'done'; P.t = 0; }
        else if (P.phase === 'done' && P.t >= 0.12) afterPlay();
        break;
      }
      case S.FIN_CHICA: {
        if (stateTime > C.CHICA_HOLD) {
          if (G.online) { G.p.score = 0; G.a.score = 0; setState(S.ESPERA_RED); }   // el servidor ya repartió la siguiente
          else nextChica();
        }
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
          const bp = G.p.score, ba = G.a.score;
          if (K.net) setScores(K.net.scores); else { G.p.score += K.res.a; G.a.score += K.res.b; }
          flyPoints(G.p, bp); flyPoints(G.a, ba);
          if (K.res.b && isDevil()) Imps.burst(W / 2, 320, 6, 30);
          if (K.res.a || K.res.b) Sfx.ronda();
        }
        if (K.applied && stateTime - K.appliedAt > C.CARTON_HOLD) {
          if (G.online) { setState(S.ESPERA_RED); break; }   // el servidor manda el mazo nuevo o el fin
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
    D.setResolution(scale * dpr);                            // sprites nítidos a la densidad real
    buildFelt();
  }

  const MENU_ROWS = { y0: 250, h: 74, gap: 8 };
  const BTN = {
    ia: { x: 40, y: 262, w: 280, h: 56 },
    online: { x: 40, y: 330, w: 280, h: 56 },
    back: { x: 14, y: 228, w: 76, h: 24 },
    menuOnline: { x: 128, y: 476, w: 104, h: 40 },
    sound: { x: 14, y: 600, w: 104, h: 26 },
    again: { x: 70, y: 476, w: 104, h: 40 },
    menu: { x: 186, y: 476, w: 104, h: 40 },
    mode: { x: 80, y: 548, w: 200, h: 34 },     // selector Aprendizaje/Experto (menú principal, zona libre bajo el lore)
  };
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  function onTap(p) {
    Sfx.unlock();                                            // reanuda el contexto para los efectos (gesto del usuario)
    if (state === S.LOBBY) return;                           // el submenú online (HTML) recibe los toques
    if (state === S.MENU) {
      if (inRect(p, BTN.sound)) { Sfx.toggle(); return; }
      if (inRect(p, BTN.mode)) { setAssist(!assist); Sfx.select(); return; }
      if (inRect(p, BTN.ia)) { Sfx.select(); setState(S.MENU_IA); return; }
      if (inRect(p, BTN.online)) { Sfx.select(); setState(S.LOBBY); CU.Lobby.open(); return; }
      return;
    }
    if (state === S.MENU_IA) {
      if (inRect(p, BTN.back)) { Sfx.select(); setState(S.MENU); return; }
      if (inRect(p, BTN.sound)) { Sfx.toggle(); return; }
      for (let i = 0; i < CU.RIVALS.length; i++) {
        const y = MENU_ROWS.y0 + 8 + i * (MENU_ROWS.h + MENU_ROWS.gap);
        if (p.x > 20 && p.x < W - 20 && p.y > y && p.y < y + MENU_ROWS.h) { Sfx.select(); Sfx.startBGM(); newGame(i); return; }   // «Jugar»: arma la música
      }
      return;
    }
    if (state === S.JUEGO_TERMINADO && stateTime > 0.8) {
      if (G.online) { if (inRect(p, BTN.menuOnline)) goMenu(); return; }
      if (inRect(p, BTN.again)) { D.Victory.stop(); newGame(CU.RIVALS.indexOf(G.rival)); Sfx.resumeBGM(); }
      else if (inRect(p, BTN.menu)) goMenu();
      return;
    }
    if (state !== S.TURNO_JUGADOR) return;
    const hit = [...G.p.hand].reverse().find((c) => Math.abs(p.x - c.x) < C.HAND_W / 2 && Math.abs(p.y - c.y) < C.HAND_H / 2 + 8);
    if (!hit) { G.selected = null; layoutHands(); return; }
    if (G.selected === hit) { humanPlay(hit); return; }      // segundo toque: jugar
    G.selected = hit; Sfx.select(); layoutHands();             // primer toque: elegir y ver qué levanta
  }

  function goMenu() {
    if (G && G.online) CU.Net.leave();
    G = null; netQueue.length = 0; Imps.clear(); D.Victory.stop(); setState(S.MENU); Sfx.resumeBGM();
  }

  // Jugada del humano: local se resuelve aquí; online se envía al servidor y se espera su veredicto.
  function humanPlay(card) {
    playCard(G.p, card);
    if (!G.online) return;
    CU.Net.move(card.id).then((r) => {
      if (r.ok || !G || !G.online) return;
      G.abandoned = 'El servidor rechazó la jugada: ' + (r.error || 'error'); G.winner = null; endGame();
    });
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    onTap({ x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale });
  });
  window.addEventListener('keydown', (e) => {
    if (state === S.TURNO_JUGADOR && G && /^[1-5]$/.test(e.key)) {
      const c = G.p.hand[parseInt(e.key, 10) - 1]; if (c) { Sfx.unlock(); Sfx.resumeBGM(); humanPlay(c); }
    }
  });
  window.addEventListener('resize', resize);

  // =====================================================================
  //  6. RENDER
  // =====================================================================
  const D = CU.Draw;
  D.attach(ctx, W, H);
  const { txt, rr, wrapLines, button, drawCard, drawCardBack, drawPortrait, drawScene, Imps } = D;
  let felt = null;
  function buildFelt() { felt = D.buildFelt(TABLE_TOP, TABLE_BOTTOM); }

  function drawScore(who, x, y, align, label) {
    txt(label, x, y, 11, 'rgba(255,255,255,0.85)', align, '700');
    // chicas ganadas (partida a 2 de 3): círculos dorados junto a la etiqueta
    const won = G.chicas[who === G.p ? 'p' : 'a'], dirC = align === 'left' ? 1 : -1, x0 = x + dirC * (align === 'left' ? 24 : 38);
    for (let i = 0; i < R.CHICAS_PARA_GANAR; i++) {
      ctx.beginPath(); ctx.arc(x0 + dirC * i * 10, y, 3.6, 0, TAU);
      if (i < won) { ctx.fillStyle = '#f5c542'; ctx.fill(); }
      ctx.strokeStyle = 'rgba(245,197,66,0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    txt(String(who.score), x, y + 20, 22, who.score >= 38 ? '#ffb3a1' : '#ffe066', align, '900');
    // marcador tradicional: un perro (verde) por cada 10 puntos y un tanto (naranja) por cada 2
    const dir = align === 'left' ? 1 : -1;
    D.drawScoreMarkers(who.score, x + dir * 46, y + 22, dir);
  }

  function drawPile(n, p, label, above = false) {
    if (n > 0) for (let i = 0; i < Math.min(5, Math.ceil(n / 4)); i++) drawCardBack(p.x + i * 1.2, p.y - i * 1.6, 36, 52);
    txt(label + ' ' + n, p.x, p.y + (above ? -36 : 36), 10, '#fff', 'center', '700');   // el del jugador va arriba: abajo lo tapa la mano
  }

  function drawPreview() {
    if (!G.selected || state !== S.TURNO_JUGADOR) return;
    if (!assist) {                                           // modo experto: sin pistas, solo el aviso de confirmación
      for (const c of G.table) c.hl = false;
      txt('Toca otra vez para jugar', W / 2, 478, 11, 'rgba(255,255,255,0.8)', 'center', '700', false);
      return;
    }
    const cap = Rules.findCapture(G.selected, G.table, lastPlayedBy(G.a));
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
    drawPile(G.p.pile.length, PILE_P, 'Cartón', true);
    if (G.selected && state === S.TURNO_JUGADOR) drawPreview(); else if (state !== S.VALIDAR_JUGADA) for (const c of G.table) c.hl = false;
    for (const c of G.table) drawCard(c, C.CARD_W, C.CARD_H);
    for (const c of G.a.hand) drawCard(c, 44, 62);
    for (const c of [...G.p.pile, ...G.a.pile]) if (!c.hidden) drawCard(c, C.CARD_W, C.CARD_H);
    if (G.play && !G.table.includes(G.play.card) && !G.p.pile.includes(G.play.card) && !G.a.pile.includes(G.play.card)) drawCard(G.play.card, C.CARD_W, C.CARD_H);
    for (const c of G.p.hand) drawCard(c, C.HAND_W, C.HAND_H);
    drawScore(G.p, 16, 590, 'left', 'Tú');
    // turno
    if (state === S.TURNO_JUGADOR && !G.selected) txt('Tu turno: elige una carta', W / 2, 478, 12, '#ffe066', 'center', '800');
    if (state === S.TURNO_RIVAL_RED) txt('esperando su jugada' + '.'.repeat(1 + Math.floor(t * 3) % 3), 74, 132, 9, '#ffe9a8', 'left', '700', false);
    if (state === S.TURNO_IA) txt('pensando' + '.'.repeat(1 + Math.floor(t * 3) % 3), 74, 132, 9, '#ffe9a8', 'left', '700', false);   // bajo el nombre, no sobre la mano
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
    if (state === S.FIN_CHICA) drawFinChica();
    drawFlyers();
    if (state === S.JUEGO_TERMINADO) drawGameOver(t);
  }

  function drawFinChica() {
    const r = G.chicaResult, pWon = r.who === G.p;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(30, 200, W - 60, 230);
    ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 1.5; ctx.strokeRect(30.5, 200.5, W - 61, 229);
    txt(pWon ? '¡Chica para ti!' : 'Chica para ' + G.rival.name, W / 2, 232, 20, pWon ? '#ffe066' : '#ff9f8f');
    const why = r.reason === 'caidas' ? '4 caídas seguidas' : r.reason === 'cuatro' ? 'Cuatro iguales' : G.p.score + '  –  ' + G.a.score;
    txt(why, W / 2, 264, 14, '#fff', 'center', '700');
    txt('Chicas  ' + G.chicas.p + '  –  ' + G.chicas.a, W / 2, 300, 18, '#fff', 'center', '900');
    if (r.zap) txt(CU.TEXT.zapateria + (r.zap === G.p ? ' Te quedaste con menos de 10' : ' para ' + G.rival.name.split(' ').slice(-1)[0]), W / 2, 336, 12.5, '#ffb3a1', 'center', '800');
    txt('Siguiente chica…', W / 2, 400, 10, 'rgba(255,255,255,0.7)', 'center', '600', false);
  }

  function drawCarton() {
    const K = G.carton;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(30, 220, W - 60, 200);
    ctx.strokeStyle = '#f5c542'; ctx.strokeRect(30.5, 220.5, W - 61, 199);
    txt(CU.TEXT.carton, W / 2, 244, 17, '#ffe066');
    txt('Tú: ' + K.shownP + ' cartas', W / 2, 282, 14, '#fff', 'center', '700');
    txt(G.rival.name + ': ' + K.shownA + ' cartas', W / 2, 308, 14, '#fff', 'center', '700');
    if (K.applied) {
      const r = K.res, lines = [], para = (s) => (s === 'a' ? ' para ti' : ' para ' + G.rival.name.split(' ').slice(-1)[0]);
      if (r.carton) lines.push((r.carton === 'a' ? '¡Cartón para ti! +' : 'Cartón para el rival +') + Rules.cartonPoints(r.carton === 'a' ? K.nP : K.nA));
      if (r.dosPorDar) lines.push(CU.TEXT.dosPorDar + ': +' + R.DOS_POR_DAR + para(r.dosPorDar));
      if (r.falla) lines.push(CU.TEXT.dosPorFalla + ': +' + R.DOS_POR_FALLA + para(r.falla === 'a' ? 'b' : 'a'));
      if (!lines.length) lines.push(r.tie || Math.max(K.nP, K.nA) >= R.CARTON_MIN ? 'El conteo no suma (regla de 38)' : 'Nadie llegó a 20 cartas');
      lines.forEach((ln, i) => txt(ln, W / 2, 344 + i * 20, 14, '#ffe066'));
      txt('Nuevo mazo…', W / 2, 390, 10, 'rgba(255,255,255,0.7)', 'center', '600', false);
    }
  }

  function drawGameOver(t) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
    const pWon = G.winner === G.p;
    if (pWon && !G.abandoned) {                                       // victoria del jugador: cartel festivo
      D.drawVictoryPoster(CU.TEXT.victoriaFrase, 'Chicas ' + G.chicas.p + ' – ' + G.chicas.a + '   ·   ' + G.p.score + ' – ' + G.a.score, CU.TEXT.victoriaTitulo);
      if (stateTime > 0.8) {
        if (G.online) button(BTN.menuOnline, 'Menú', true);
        else { button(BTN.again, 'Revancha', true); button(BTN.menu, 'Menú', false); }
      }
      return;
    }
    drawPortrait(G.rival, W / 2, 230, 1.8, t);
    const title = G.abandoned && !G.winner ? 'Partida interrumpida' : pWon ? CU.TEXT.youWin : CU.TEXT.youLose;
    txt(title, W / 2, 320, 26, pWon ? '#ffe066' : G.abandoned && !G.winner ? '#fbf3e4' : '#ff9f8f');
    if (G.abandoned) txt(G.abandoned, W / 2, 392, 12, '#fbf3e4', 'center', '600', false);
    txt(G.p.score + '  –  ' + G.a.score + (G.chicas ? '   ·   chicas ' + G.chicas.p + '–' + G.chicas.a : ''), W / 2, 356, 18, '#fff');
    if (G.chicaResult && G.chicaResult.zap === G.p) txt(CU.TEXT.zapateria + ' Menos de 10 puntos', W / 2, 376, 12, '#ffb3a1', 'center', '800');
    if (G.bubble) txt('«' + G.bubble.text + '»', W / 2, 392, 12, '#fbf3e4', 'center', '600', false);
    wrapLines(G.rival.legend, 300, '500 9.5px system-ui, sans-serif').slice(0, 3).forEach((ln, i) => txt(ln, W / 2, 410 + i * 14, 9.5, 'rgba(255,255,255,0.75)', 'center', '500', false));
    if (stateTime > 0.8) {
      if (G.online) button(BTN.menuOnline, 'Menú', true);
      else { button(BTN.again, 'Revancha', true); button(BTN.menu, 'Menú', false); }
    }
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
    if (state !== S.MENU_IA) {
      // menú principal: dos modos de juego
      button(BTN.ia, '🤖  Jugar contra la IA', true);
      button(BTN.online, '🤝  Jugar con un Amigo (Online)', false);
      wrapLines(CU.TEXT.lore, 290, '500 10px system-ui, sans-serif').slice(0, 4)
        .forEach((ln, i) => txt(ln, W / 2, 420 + i * 15, 10, 'rgba(251,243,228,0.8)', 'center', '500', false));
      // selector de modo (spec 008): Aprendizaje muestra pistas; Experto las oculta
      button(BTN.mode, 'Modo: ' + (assist ? 'Aprendizaje' : 'Experto'), false);
      txt(assist ? 'Con pistas: te muestra qué levanta cada carta' : 'Sin pistas: juega a ciegas, como en la mesa', W / 2, 594, 9, 'rgba(251,243,228,0.7)', 'center', '600', false);
    } else {
    button(BTN.back, '‹ Volver', false);
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
    }
    button(BTN.sound, Sfx.isMuted() ? 'Sonido: NO' : 'Sonido: SÍ', false);
    txt('v' + CU.META.version + ' | Desarrollado por ' + CU.META.author, W - 12, 628, 7.5, 'rgba(251,243,228,0.55)', 'right', '500', false);
    const au = Sfx.status(); txt('Audio: ' + au.mode + (au.loaded.includes('piano') ? ' · fondo: 8-bit' : ''), W - 12, 612, 7.5, 'rgba(251,243,228,0.55)', 'right', '500', false);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (!G || state === S.MENU || state === S.MENU_IA || state === S.LOBBY) drawMenu(simTime); else drawGame(simTime);
    Imps.draw();
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
  Sfx.preloadAudio();                                       // asíncrona: el juego arranca ya; la música cambia a muestras al llegar
  requestAnimationFrame((t) => { last = t; frame(t); });

  // Gancho para pruebas automatizadas.
  CU._debug = { S, get state() { return state; }, get game() { return G; }, get frames() { return frames; }, get assist() { return assist; }, setAssist, newGame, playCard, aiChoose, setState, render, flyPoints, humanPlay, netQueue, checkWin };
})(window.CU);
