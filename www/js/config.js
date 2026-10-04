/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: js/config.js — Lore de las leyendas, rivales, baraja y reglas
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.3.0
 */
/* Solo datos: la lógica vive en game.js. Las reglas con variantes regionales se ajustan en CU.RULES. */
window.CU = window.CU || {};
(function (CU) {
  'use strict';

  CU.META = {
    name: 'Cuarenta: El Juicio de las Leyendas',
    version: '1.3.0',
    author: 'Byron Sebastián Rosero Díaz',
    role: 'Ingeniero de Software',
    year: 2026,
    copyright: '© 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.3.0',
  };

  // ------------------------------------------------------------------ motor
  CU.CFG = {
    W: 360, H: 640,            // resolución lógica (vertical)
    STEP: 1 / 60,              // paso fijo de simulación
    HAND_SIZE: 5,
    CARD_W: 50, CARD_H: 72,    // carta en la mesa
    HAND_W: 60, HAND_H: 86,    // carta en la mano del jugador
    ANIM_PLAY: 0.2,            // s: «lanzamiento flotante» de la mano a la mesa
    ANIM_DEAL: 0.2,            // s: vuelo de cada carta desde el mazo al repartir
    CARD_EASE: 'linear',       // 'linear' = Lerp puro (pedido) · 'out' = Lerp con frenado al aterrizar
    CARD_TILT: 0.12,           // rad: inclinación máxima de la carta en vuelo (0 = sin inclinación)
    ANIM_CAPTURE: 0.45,        // s: cartas levantadas hacia el cartón
    AI_THINK: [0.7, 1.3],      // s: pausa "humana" de la IA
    DEAL_GAP: 0.07,            // s entre carta y carta al repartir
    HIGHLIGHT: 0.45,           // s resaltando lo que se levanta
    COUNT_STEP: 0.045,         // s por carta al contar el cartón
    CARTON_HOLD: 2.2,          // s mostrando el resultado del cartón
    IMPS: {                    // diablillos procedurales (solo contra Cantuña y el Diablo)
      AMBIENT_IMPS: 0.6,       // diablillos/s que suben del atrio
      AMBIENT_SPARKS: 4,       // chispas/s
      BURST_IMPS: 7, BURST_SPARKS: 28,   // ráfaga cuando el Diablo hace caída o limpia
    },
  };

  // ------------------------------------------------------------------ reglas
  // Fuentes: reglamentos publicados (Tabletopia «Reglas del 40», play40.app) y tradición quiteña.
  // Donde las fuentes difieren, la opción queda configurable.
  CU.RULES = {
    WIN_POINTS: 40,
    CAIDA: 2,                  // levantar con igual la carta que el rival acaba de jugar
    LIMPIA: 2,                 // dejar la mesa vacía
    RONDA: 2,                  // recibir tres cartas iguales
    CUATRO_IGUALES_GANA: true, // recibir las cuatro iguales gana la chica
    SUMA_SOLO_NUMEROS: true,   // solo As–7 suman; las figuras nunca
    ESCALERA_TRAS_SUMA: true,  // después de sumar se sigue la escalera desde la carta jugada
    CARTON_MIN: 20,            // con 20 cartas: 6 puntos
    CARTON_BASE: 6,
    CARTON_REDONDEO_PAR: true, // 21–22 cartas → 8; 23–24 → 10…
    REGLA_38: true,            // con 38 puntos solo cuenta la caída (no limpia, ronda ni cartón)
    CARTON_BLOQUEO_30: false,  // variante: con 30+ el cartón no suma (desactivada por defecto)
    SOBRANTES_AL_ULTIMO: true, // cartas que quedan en la mesa al final → último que levantó
    DOS_POR_DAR: 2,            // empate de cartón: +2 al que repartió
  };

  // ------------------------------------------------------------------ baraja
  // 40 cartas: As–7 y tres figuras por palo. Los palos no influyen en las reglas (solo el número).
  // order: posición en la escalera (As=1 … 7, Sota=8, Caballo=9, Rey=10). value: valor para sumar (figuras: null).
  CU.RANKS = [
    { id: 'A', label: 'A', name: 'As',      order: 1,  value: 1 },
    { id: '2', label: '2', name: 'Dos',     order: 2,  value: 2 },
    { id: '3', label: '3', name: 'Tres',    order: 3,  value: 3 },
    { id: '4', label: '4', name: 'Cuatro',  order: 4,  value: 4 },
    { id: '5', label: '5', name: 'Cinco',   order: 5,  value: 5 },
    { id: '6', label: '6', name: 'Seis',    order: 6,  value: 6 },
    { id: '7', label: '7', name: 'Siete',   order: 7,  value: 7 },
    { id: 'J', label: 'S', name: 'Sota',    order: 8,  value: null, figure: 'sota' },
    { id: 'Q', label: 'C', name: 'Caballo', order: 9,  value: null, figure: 'caballo' },
    { id: 'K', label: 'R', name: 'Rey',     order: 10, value: null, figure: 'rey' },
  ];
  // Cuatro «brillos» quiteños (equivalen a ♦ ♥ ♠ ♣ de la baraja inglesa con que se juega en Quito).
  CU.SUITS = [
    { id: 'oro',      name: 'Soles de Oro',                 symbol: 'sol',     color: '#c98a00', english: '♦' },
    { id: 'basilica', name: 'Corazones de la Basílica',     symbol: 'corazon', color: '#b3122e', english: '♥' },
    { id: 'espada',   name: 'Espadas de la Independencia',  symbol: 'espada',  color: '#1f3a5f', english: '♠' },
    { id: 'campana',  name: 'Campanas de San Francisco',    symbol: 'campana', color: '#7a4a1c', english: '♣' },
  ];

  // ------------------------------------------------------------------ rivales (IA)
  // style: pesos para la IA. points = ansia de puntos inmediatos; cards = levantar muchas cartas;
  // risk = cuidado de no dejar caídas; noise = azar; memory = cuenta las cartas que ya salieron.
  CU.RIVALS = [
    {
      id: 'chulla', name: 'El Chulla Quiteño', place: 'La Ronda', difficulty: 1,
      legend: 'Elegante, enamorado y sin un sucre en el bolsillo. Recorre la calle La Ronda entre serenatas y canelazos; juega para lucirse.',
      style: { points: 1.4, cards: 1.2, risk: 0.3, noise: 0.35, memory: false },
      colors: { coat: '#1b1b1b', trim: '#c0392b', hat: '#2b2b2b', skin: '#c58c5c' },
      scene: { sky: ['#1a1440', '#4a2a5e'], accent: '#f1c40f', label: 'calle de faroles y balcones' },
      phrases: {
        hello: ['¡Qué fue, ve! ¿Una manito de cuarenta?', '¡Simón, juguemos que la noche es joven!'],
        caida: ['¡Caída por shunsho!', '¡Elé, te caí!', '¡Así se juega en La Ronda!'],
        limpia: ['¡Limpiecito como el Panecillo!', '¡Mesa limpia, como mis bolsillos!'],
        suffer: ['¡Chuta!', '¡Pucha, me cayeron!', '¡Achachay, qué frío me dio!'],
        thirtyEight: ['¡Treinta y ocho que no juegan!', '¡Treinta y ocho, a ver si me caes!'],
        win: ['¡De ley, ganó el chulla!', '¡Para el canelazo, ñaño!'],
        lose: ['¡Qué bestia, me ganaste!', 'Ya, ya… la revancha otro día.'],
      },
    },
    {
      id: 'gallo', name: 'El Gallo de la Catedral', place: 'Plaza Grande', difficulty: 2,
      legend: 'Desde lo alto de la Catedral vio al vanidoso que se burlaba de él cada noche… hasta que el gallo bajó a darle una lección. Vigila cada carta.',
      style: { points: 1.0, cards: 0.9, risk: 1.6, noise: 0.12, memory: false },
      colors: { coat: '#b8860b', trim: '#c0392b', hat: '#c0392b', skin: '#e0b04a' },
      scene: { sky: ['#0f2340', '#2d5a8c'], accent: '#f5c542', label: 'Plaza Grande y la Catedral' },
      phrases: {
        hello: ['¡Quiquiriquí! Aquí nadie me cae.', 'Desde la Catedral lo veo todo.'],
        caida: ['¡Picotazo! Caída.', '¡Te caí desde lo alto!'],
        limpia: ['¡Limpiecito como el Panecillo!', '¡Ni una pluma queda en la mesa!'],
        suffer: ['¡Cocoró… eso dolió!', '¡Ave María!'],
        thirtyEight: ['¡Treinta y ocho que no juegan!'],
        win: ['¡Quiquiriquí! El gallo no perdona.', 'Para mí no hay quien valga.'],
        lose: ['Me bajaron de la torre…', 'Buen juego, vecino.'],
      },
    },
    {
      id: 'almeida', name: 'El Padre Almeida', place: 'Convento de San Diego', difficulty: 3,
      legend: 'Cada noche escapaba del convento trepando la imagen de un Cristo. «¿Hasta cuándo, Padre Almeida?» — «Hasta la vuelta, Señor». Juega como vive: impredecible.',
      style: { points: 1.1, cards: 1.0, risk: 1.0, noise: 0.6, memory: false },
      colors: { coat: '#5a4632', trim: '#e8d9c0', hat: null, skin: '#d8a878' },
      scene: { sky: ['#05060f', '#1d2440'], accent: '#dfe6ff', label: 'claustro de San Diego a medianoche' },
      phrases: {
        hello: ['Hasta la vuelta, Señor… pero antes, una partida.', 'Shhh, que no se entere el prior.'],
        caida: ['¡Caída, hijo mío!', '¡Bendita caída!'],
        limpia: ['¡Limpiecito como el Panecillo!', 'Mesa limpia, alma limpia.'],
        suffer: ['¡Ave María Purísima!', '¡Ay, Diosito!'],
        thirtyEight: ['¡Treinta y ocho que no juegan!', 'Treinta y ocho… paciencia, paciencia.'],
        win: ['Hasta la vuelta… con la victoria.', '¡Bendito cuarenta!'],
        lose: ['Me pescaron antes de la vuelta.', 'Penitencia aceptada.'],
      },
    },
    {
      id: 'cantuna', name: 'Cantuña y el Diablo', place: 'Atrio de San Francisco', difficulty: 4,
      legend: 'Cantuña pactó con el Diablo para terminar el atrio en una noche, pero escondió una piedra y salvó su alma. Juntos cuentan cada carta que cae.',
      style: { points: 1.2, cards: 1.0, risk: 1.4, noise: 0.05, memory: true, lookahead: true },
      colors: { coat: '#4a0d0d', trim: '#f1c40f', hat: '#1a0505', skin: '#a8603a' },
      scene: { sky: ['#1a0505', '#5a1a0a'], accent: '#ff7b2a', label: 'atrio de San Francisco en la noche del pacto' },
      phrases: {
        hello: ['Una piedra falta… ¿será tu carta?', 'El trato es simple: el que llegue a cuarenta se lleva el alma.'],
        caida: ['¡Caída! Esa piedra era mía.', '¡Ja! Caída por shunsho.'],
        limpia: ['¡Limpiecito como el Panecillo!', 'Ni una piedra en el atrio.'],
        suffer: ['¡Maldita piedra!', '¡Por todos los cuernos!'],
        thirtyEight: ['¡Treinta y ocho que no juegan!', 'Treinta y ocho… el pacto aún no se cumple.'],
        win: ['El atrio está completo. Tu alma, también.', 'El Diablo nunca pierde dos veces.'],
        lose: ['Escondiste la piedra… como Cantuña.', '¡Otra vez me engañan en San Francisco!'],
      },
    },
  ];

  // ------------------------------------------------------------------ frases del juego y fiesta
  CU.TEXT = {
    tagline: 'Fiestas de Quito · El juego de cartas de la capital',
    lore: 'Cada diciembre, en las Fiestas de Quito, las leyendas bajan de sus iglesias y plazas a jugar cuarenta. Gánales a todas.',
    caida: '¡CAÍDA!', limpia: '¡LIMPIA!', ronda: '¡RONDA!', cuatro: '¡CUATRO IGUALES!',
    carton: 'Conteo del cartón', dosPorDar: 'Dos por dar',
    regla38: 'Con 38 solo vale la caída',
    youWin: '¡Ganaste la chica!', youLose: 'Perdiste la chica',
  };
})(window.CU);
