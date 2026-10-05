/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: js/draw.js — Arte procedural cartoon: naipes quiteños, figuras satíricas, perros y tantos, escenarios y diablillos
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.8.0
 */
/*
 * Estilo: cartoon humorístico propio — contorno de tinta negra, colores planos saturados, caricatura quiteña.
 *
 * Rendimiento (objetivo 60 FPS en gama baja):
 *  - Palos, figuras, perros/tantos, reversos y el diablillo se pintan UNA vez en canvas fuera de pantalla (sprites) a la
 *    resolución real (escala × devicePixelRatio) y luego solo se copian con drawImage.
 *  - Se cachea el icono, no la carta completa: 40 cartas × 3 tamaños × DPR 3 superaría 15 MB de RAM.
 *  - Sin shadowBlur por carta (es lo más caro del canvas 2D): sombra falsa desplazada.
 *  - Partículas en un pool fijo (sin asignar memoria por frame → sin pausas del recolector de basura).
 */
window.CU = window.CU || {};
(function (CU) {
  'use strict';
  const TAU = Math.PI * 2;
  let ctx = null, W = 360, H = 640, RES = 1;           // RES = píxeles físicos por unidad lógica
  const cache = new Map();

  // ------------------------------------------------------------------ sprites
  // Crea (una vez) un canvas de w×h unidades lógicas; `paint(g)` dibuja con el origen en el centro.
  function sprite(key, w, h, paint) {
    let cv = cache.get(key);
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(w * RES)); cv.height = Math.max(1, Math.ceil(h * RES));
      const g = cv.getContext('2d');
      g.setTransform(RES, 0, 0, RES, (w * RES) / 2, (h * RES) / 2);
      paint(g);
      cache.set(key, cv);
    }
    return cv;
  }
  function blit(cv, x, y, w, h) { ctx.drawImage(cv, x - w / 2, y - h / 2, w, h); }

  // ------------------------------------------------------------------ utilidades de texto y formas
  function txt(s, x, y, size, color, align = 'center', weight = '800', stroke = true) {
    ctx.font = `${weight} ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = Math.max(2, size / 6); ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function rrOn(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  const rr = (x, y, w, h, r) => rrOn(ctx, x, y, w, h, r);
  function wrapLines(text, maxW, font) {
    ctx.font = font; const out = []; let cur = '';
    for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  function button(r, label, primary) {
    rr(r.x, r.y, r.w, r.h, 8); ctx.fillStyle = primary ? '#d4a72c' : 'rgba(255,255,255,0.12)'; ctx.fill();
    ctx.strokeStyle = primary ? '#d4a72c' : 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    txt(label, r.x + r.w / 2, r.y + r.h / 2, r.h >= 50 ? 15 : 12, primary ? '#2b1a08' : '#fff', 'center', '800', false);   // botones grandes del menú: 15 px
  }

  // =====================================================================
  //  1. ESTILO CARTOON: tinta negra de contorno + colores planos saturados
  //     Todas las piezas se pintan con el origen en el centro. `detail` = nivel de detalle por tamaño.
  // =====================================================================
  const INK = '#1a1110';
  function ink(g, lw) { g.strokeStyle = INK; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; }
  function fs(g, color) { g.fillStyle = color; g.fill(); g.stroke(); }          // relleno plano + contorno
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
  function oval(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function poly(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }

  // ------------------------------------------------------------------ los cuatro brillos (radio ≈ s)
  const PAINT = {
    // Soles de Oro: sol incásico, dos coronas concéntricas de rayos y rostro del Inti
    sol(g, s, detail) {
      ink(g, s * 0.08);
      for (let k = 0; k < 16; k++) {
        const a = k * TAU / 16, long = k % 2 === 0, r0 = s * 0.46, r1 = s * (long ? 1 : 0.76), h = long ? 0.13 : 0.17;
        poly(g, [Math.cos(a - h) * r0, Math.sin(a - h) * r0, Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a + h) * r0, Math.sin(a + h) * r0]);
        fs(g, long ? '#ffc41f' : '#ff9d00');
      }
      circle(g, 0, 0, s * 0.5); fs(g, '#ffd84a');
      g.strokeStyle = '#e08a00'; g.lineWidth = s * 0.05; circle(g, 0, 0, s * 0.37); g.stroke();
      if (detail) {
        g.fillStyle = INK; oval(g, -s * 0.14, -s * 0.07, s * 0.055, s * 0.07); g.fill(); oval(g, s * 0.14, -s * 0.07, s * 0.055, s * 0.07); g.fill();
        ink(g, s * 0.045); g.beginPath(); g.arc(0, s * 0.06, s * 0.17, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        g.fillStyle = 'rgba(255,90,60,0.55)'; circle(g, -s * 0.27, s * 0.1, s * 0.07); g.fill(); circle(g, s * 0.27, s * 0.1, s * 0.07); g.fill();
      }
    },
    // Corazones de la Basílica: corazón rojo brillante con ventanal ojival y cruz dorada
    corazon(g, s, detail) {
      ink(g, s * 0.08);
      g.beginPath(); g.moveTo(0, s * 0.82);
      g.bezierCurveTo(-s * 1.15, s * 0.02, -s * 0.62, -s * 0.95, 0, -s * 0.38);
      g.bezierCurveTo(s * 0.62, -s * 0.95, s * 1.15, s * 0.02, 0, s * 0.82); g.closePath();
      fs(g, '#e8162c');
      g.fillStyle = '#ff7a86'; oval(g, -s * 0.42, -s * 0.24, s * 0.13, s * 0.07, -0.7); g.fill();        // brillo plano
      if (detail) {
        const w = s * 0.22, base = s * 0.4, apex = -s * 0.28;
        g.strokeStyle = '#ffd23f'; g.lineWidth = s * 0.06;
        g.beginPath(); g.moveTo(-w, base); g.lineTo(-w, 0); g.quadraticCurveTo(-w, apex + s * 0.1, 0, apex);
        g.quadraticCurveTo(w, apex + s * 0.1, w, 0); g.lineTo(w, base); g.stroke();
        g.lineWidth = s * 0.035; g.beginPath(); g.moveTo(0, -s * 0.05); g.lineTo(0, base); g.stroke();
      }
      g.fillStyle = '#ffd23f'; ink(g, s * 0.03);
      g.beginPath(); g.rect(-s * 0.045, -s * 0.66, s * 0.09, s * 0.3); g.rect(-s * 0.13, -s * 0.57, s * 0.26, s * 0.08); g.fill();
    },
    // Espadas de la Independencia: hoja delgada, gavilanes dorados cruzados, puño y pomo
    espada(g, s) {
      ink(g, s * 0.06);
      poly(g, [0, -s, s * 0.1, -s * 0.8, s * 0.1, s * 0.3, -s * 0.1, s * 0.3, -s * 0.1, -s * 0.8]); fs(g, '#e6edf5');
      g.strokeStyle = '#8a9bb0'; g.lineWidth = s * 0.035; g.beginPath(); g.moveTo(0, -s * 0.82); g.lineTo(0, s * 0.26); g.stroke();
      ink(g, s * 0.2); g.beginPath(); g.moveTo(-s * 0.5, s * 0.22); g.quadraticCurveTo(0, s * 0.5, s * 0.5, s * 0.22); g.stroke();   // contorno del gavilán
      g.strokeStyle = '#ffcc33'; g.lineWidth = s * 0.11; g.stroke();
      ink(g, s * 0.05); circle(g, -s * 0.53, s * 0.2, s * 0.1); fs(g, '#ffcc33'); circle(g, s * 0.53, s * 0.2, s * 0.1); fs(g, '#ffcc33');
      g.beginPath(); g.rect(-s * 0.08, s * 0.4, s * 0.16, s * 0.36); fs(g, '#6b3a1e');
      circle(g, 0, s * 0.86, s * 0.12); fs(g, '#ffcc33');
    },
    // Campanas de San Francisco: campana colonial de bronce (dos tonos planos)
    campana(g, s, detail) {
      ink(g, s * 0.07);
      g.beginPath(); g.arc(0, -s * 0.8, s * 0.13, Math.PI, TAU); g.lineWidth = s * 0.16; g.stroke();
      g.strokeStyle = '#c98a3a'; g.lineWidth = s * 0.08; g.stroke();                                      // asa
      ink(g, s * 0.07);
      g.beginPath();
      g.moveTo(-s * 0.2, -s * 0.74); g.quadraticCurveTo(-s * 0.48, -s * 0.72, -s * 0.48, -s * 0.15);
      g.lineTo(-s * 0.56, s * 0.32); g.quadraticCurveTo(-s * 0.6, s * 0.48, -s * 0.78, s * 0.54);
      g.lineTo(s * 0.78, s * 0.54); g.quadraticCurveTo(s * 0.6, s * 0.48, s * 0.56, s * 0.32);
      g.lineTo(s * 0.48, -s * 0.15); g.quadraticCurveTo(s * 0.48, -s * 0.72, s * 0.2, -s * 0.74); g.closePath();
      fs(g, '#d99a45');
      g.fillStyle = '#a8662a';                                                                              // sombra plana lateral
      g.beginPath(); g.moveTo(s * 0.18, -s * 0.72); g.quadraticCurveTo(s * 0.46, -s * 0.66, s * 0.46, -s * 0.15); g.lineTo(s * 0.54, s * 0.32);
      g.quadraticCurveTo(s * 0.58, s * 0.47, s * 0.74, s * 0.52); g.lineTo(s * 0.3, s * 0.52); g.lineTo(s * 0.22, -s * 0.1); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = s * 0.05;
      g.beginPath(); g.moveTo(-s * 0.47, -s * 0.38); g.lineTo(s * 0.47, -s * 0.38); g.moveTo(-s * 0.6, s * 0.42); g.lineTo(s * 0.6, s * 0.42); g.stroke();
      if (detail) { g.strokeStyle = '#ffe2a8'; g.lineWidth = s * 0.06; g.beginPath(); g.moveTo(-s * 0.28, -s * 0.55); g.quadraticCurveTo(-s * 0.34, 0, -s * 0.38, s * 0.28); g.stroke(); }
      ink(g, s * 0.05); circle(g, 0, s * 0.68, s * 0.13); fs(g, '#6b3a1e');
    },
  };
  function suitIcon(sym, x, y, s) {
    const key = 'suit|' + sym + '|' + s.toFixed(2), d = s * 2.25;
    blit(sprite(key, d, d, (g) => PAINT[sym](g, s, s >= 9)), x, y, d, d);
  }

  // =====================================================================
  //  2. FIGURAS CARTOON QUITEÑAS
  //     Caja de diseño: 100 × 130 unidades, origen al centro (x ∈ ±50, y ∈ ±65). `accent` = color del palo.
  // =====================================================================
  const SKIN = '#f6c9a0', CHEEK = 'rgba(255,90,90,0.55)';
  function eyes(g, x, y, gap, r, lookX = 0, lookY = 0) {               // ojos cartoon: blanco + pupila
    ink(g, 2.2);
    circle(g, x - gap, y, r); fs(g, '#fff'); circle(g, x + gap, y, r); fs(g, '#fff');
    g.fillStyle = INK; circle(g, x - gap + lookX, y + lookY, r * 0.45); g.fill(); circle(g, x + gap + lookX, y + lookY, r * 0.45); g.fill();
  }
  function hornTri(g, bx, by, tx, ty, side) {                         // cuerno = triángulo
    poly(g, [bx - 5 * side, by, tx, ty, bx + 5 * side, by + 3]); fs(g, '#d7141f');
  }

  const FIG = {
    // REY (K): diablillo gordo y pícaro, cuernos rojos, corona, barba blanca y copa de canelazo
    rey(g, accent) {
      ink(g, 3);
      // cola con punta de flecha
      g.beginPath(); g.moveTo(22, 46); g.bezierCurveTo(48, 50, 46, 22, 40, 14); g.stroke();
      poly(g, [40, 14, 34, 18, 44, 6]); fs(g, '#d7141f');
      // capa del color del palo
      g.beginPath(); g.moveTo(-36, -2); g.quadraticCurveTo(-46, 40, -38, 58); g.lineTo(38, 58); g.quadraticCurveTo(46, 40, 36, -2); g.closePath(); fs(g, accent);
      // panza
      oval(g, 0, 30, 30, 28); fs(g, '#ef4a35');
      oval(g, 0, 36, 18, 18); fs(g, '#ff9b7a');
      circle(g, 0, 38, 2); g.fillStyle = INK; g.fill();                                               // ombligo
      // pezuñas
      oval(g, -14, 60, 9, 5); fs(g, INK); oval(g, 14, 60, 9, 5); fs(g, INK);
      // brazo izquierdo en la cadera
      g.beginPath(); g.moveTo(-26, 12); g.quadraticCurveTo(-40, 22, -28, 30); g.lineWidth = 9; g.stroke(); g.strokeStyle = '#ef4a35'; g.lineWidth = 5; g.stroke();
      // cabeza
      ink(g, 3);
      hornTri(g, -12, -36, -22, -62, 1); hornTri(g, 12, -36, 22, -62, -1);
      circle(g, 0, -22, 21); fs(g, '#ef4a35');
      // corona dorada entre los cuernos
      poly(g, [-11, -40, -11, -52, -5, -45, 0, -55, 5, -45, 11, -52, 11, -40]); fs(g, '#ffd23f');
      // barba blanca en festones
      g.beginPath(); g.moveTo(-19, -16);
      g.quadraticCurveTo(-22, -2, -14, 2); g.quadraticCurveTo(-12, 10, -5, 8); g.quadraticCurveTo(0, 16, 5, 8);
      g.quadraticCurveTo(12, 10, 14, 2); g.quadraticCurveTo(22, -2, 19, -16); g.quadraticCurveTo(0, -8, -19, -16); g.closePath(); fs(g, '#ffffff');
      // cara pícara: cejas en V, ojos de lado, nariz roja, sonrisa torcida
      eyes(g, 0, -27, 7, 5, 2, 0);
      ink(g, 2.6); g.beginPath(); g.moveTo(-13, -36); g.lineTo(-3, -31); g.moveTo(13, -36); g.lineTo(3, -31); g.stroke();
      circle(g, 0, -20, 4); fs(g, '#b3121b');
      g.beginPath(); g.moveTo(-8, -12); g.quadraticCurveTo(2, -6, 10, -14); g.stroke();
      // brazo derecho levantando la copa de canelazo
      g.beginPath(); g.moveTo(24, 10); g.quadraticCurveTo(36, 4, 34, -8); g.lineWidth = 9; g.stroke(); g.strokeStyle = '#ef4a35'; g.lineWidth = 5; g.stroke();
      ink(g, 2.4);
      poly(g, [26, -26, 44, -26, 39, -10, 31, -10]); fs(g, 'rgba(220,240,255,0.9)');                  // vaso
      poly(g, [27.5, -21, 42.5, -21, 39, -11, 31, -11]); g.fillStyle = '#ff8a1f'; g.fill();             // canelazo
      g.beginPath(); g.moveTo(35, -10); g.lineTo(35, -4); g.moveTo(30, -3); g.lineTo(40, -3); g.stroke();
      circle(g, 34, -8, 4); fs(g, '#ef4a35');                                                           // mano
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.8;                                       // vapor
      for (let k = 0; k < 3; k++) { const x = 30 + k * 5; g.beginPath(); g.moveTo(x, -30); g.quadraticCurveTo(x - 3, -35, x, -39); g.quadraticCurveTo(x + 3, -43, x, -47); g.stroke(); }
    },

    // SOTA (J): Padre Almeida, sombrero de teja, cara de juerguista asustado y pergamino del pacto
    sota(g, accent) {
      ink(g, 3);
      // hábito
      g.beginPath(); g.moveTo(-26, 2); g.lineTo(-40, 62); g.lineTo(40, 62); g.lineTo(26, 2); g.quadraticCurveTo(0, -6, -26, 2); g.closePath(); fs(g, '#7a4a2a');
      g.strokeStyle = '#5a341c'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, 30); g.lineTo(-14, 60); g.moveTo(12, 30); g.lineTo(16, 60); g.stroke();
      // estola del color del palo
      ink(g, 2.4); poly(g, [-14, 0, -6, 0, -8, 50, -18, 50]); fs(g, accent); poly(g, [6, 0, 14, 0, 18, 50, 8, 50]); fs(g, accent);
      // pergamino del pacto (con sello de lacre)
      poly(g, [-24, 16, 24, 16, 24, 42, -24, 42]); fs(g, '#f6e3b0');
      oval(g, -24, 29, 4, 14); fs(g, '#e8cf8e'); oval(g, 24, 29, 4, 14); fs(g, '#e8cf8e');
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-16, 22 + k * 6); g.lineTo(k === 2 ? 2 : 14, 22 + k * 6); g.stroke(); }
      ink(g, 2); circle(g, 12, 38, 5); fs(g, '#c8102e');
      // manos temblorosas
      ink(g, 2.4); circle(g, -28, 30, 6); fs(g, SKIN); circle(g, 28, 30, 6); fs(g, SKIN);
      g.beginPath(); g.moveTo(-38, 24); g.lineTo(-41, 22); g.moveTo(-38, 30); g.lineTo(-42, 30); g.moveTo(38, 24); g.lineTo(41, 22); g.moveTo(38, 30); g.lineTo(42, 30); g.stroke();
      // cabeza
      ink(g, 3); circle(g, 0, -16, 20); fs(g, SKIN);
      g.fillStyle = CHEEK; circle(g, -12, -8, 5); g.fill(); circle(g, 12, -8, 5); g.fill();                // chapas de juerga
      eyes(g, 0, -20, 7, 6, 0, 1.5);                                                                       // ojos desorbitados
      ink(g, 2.4); g.beginPath(); g.moveTo(-13, -31); g.quadraticCurveTo(-7, -35, -2, -31); g.moveTo(13, -31); g.quadraticCurveTo(7, -35, 2, -31); g.stroke();
      circle(g, 0, -12, 4.5); fs(g, '#f08070');                                                           // nariz colorada
      oval(g, 0, -3, 4, 5); fs(g, '#5a1a12');                                                             // boca en «O»
      g.beginPath(); g.moveTo(21, -26); g.quadraticCurveTo(26, -20, 23, -16); g.quadraticCurveTo(18, -19, 21, -26); fs(g, '#8fd3ff');   // gota de sudor
      // sombrero de teja: ala larga con los extremos enrollados + copa
      ink(g, 3);
      g.beginPath(); g.moveTo(-44, -36); g.quadraticCurveTo(-44, -44, -36, -42); g.quadraticCurveTo(0, -36, 36, -42);
      g.quadraticCurveTo(44, -44, 44, -36); g.quadraticCurveTo(0, -26, -44, -36); g.closePath(); fs(g, '#1f1d26');
      g.beginPath(); g.arc(0, -40, 14, Math.PI, TAU); g.closePath(); fs(g, '#1f1d26');
      g.strokeStyle = '#5c5a6e'; g.lineWidth = 2; g.beginPath(); g.moveTo(-30, -38); g.quadraticCurveTo(0, -33, 30, -38); g.stroke();
    },

    // CABALLO (Q): el Chulla Quiteño montado en su caballito de palo
    caballo(g, accent) {
      ink(g, 3);
      // palo del caballito
      g.lineWidth = 7; g.beginPath(); g.moveTo(-36, 62); g.lineTo(20, -6); g.stroke(); g.strokeStyle = '#a0672e'; g.lineWidth = 4; g.stroke();
      // piernas a horcajadas
      ink(g, 3);
      g.beginPath(); g.moveTo(-14, 30); g.lineTo(-22, 58); g.lineTo(-10, 58); g.lineTo(-4, 34); g.closePath(); fs(g, '#2a2731');
      g.beginPath(); g.moveTo(2, 30); g.lineTo(10, 58); g.lineTo(22, 58); g.lineTo(12, 30); g.closePath(); fs(g, '#2a2731');
      oval(g, -18, 60, 8, 4); fs(g, INK); oval(g, 18, 60, 8, 4); fs(g, INK);
      // torso: saco negro, camisa blanca, corbatín del color del palo
      g.beginPath(); g.moveTo(-20, -4); g.lineTo(-22, 34); g.lineTo(16, 34); g.lineTo(14, -4); g.quadraticCurveTo(-3, -10, -20, -4); g.closePath(); fs(g, '#2a2731');
      poly(g, [-9, -6, 3, -6, -3, 14]); fs(g, '#ffffff');
      poly(g, [-10, -4, -3, -1, -10, 2]); fs(g, accent); poly(g, [4, -4, -3, -1, 4, 2]); fs(g, accent);
      // cabeza: guiño, bigote fino, sonrisa de conquistador
      ink(g, 3); circle(g, -3, -22, 17); fs(g, SKIN);
      g.fillStyle = CHEEK; circle(g, -13, -16, 4); g.fill();
      ink(g, 2.4); circle(g, -9, -24, 4.5); fs(g, '#fff'); g.fillStyle = INK; circle(g, -8, -24, 2); g.fill();
      g.beginPath(); g.moveTo(1, -24); g.quadraticCurveTo(5, -27, 9, -24); g.stroke();                       // guiño
      g.beginPath(); g.moveTo(-10, -15); g.quadraticCurveTo(-3, -18, 4, -15); g.lineWidth = 3; g.stroke();     // bigote
      g.lineWidth = 2.2; g.beginPath(); g.moveTo(-8, -11); g.quadraticCurveTo(-2, -6, 4, -11); g.stroke();
      // sombrero
      ink(g, 3);
      oval(g, -3, -36, 22, 5); fs(g, '#1f1d26');
      g.beginPath(); g.rect(-14, -52, 22, 16); fs(g, '#1f1d26');
      g.fillStyle = accent; g.fillRect(-13.5, -42, 21, 4);
      // brazo que sujeta las riendas
      g.beginPath(); g.moveTo(10, 2); g.quadraticCurveTo(22, 8, 22, -2); g.lineWidth = 8; g.stroke(); g.strokeStyle = '#2a2731'; g.lineWidth = 4.5; g.stroke();
      ink(g, 2.4); circle(g, 22, -3, 4.5); fs(g, SKIN);
      // cabeza del caballito
      ink(g, 3);
      g.beginPath(); g.moveTo(16, -4); g.quadraticCurveTo(18, -26, 30, -30); g.quadraticCurveTo(46, -30, 48, -16);
      g.quadraticCurveTo(48, -8, 40, -8); g.quadraticCurveTo(30, -10, 30, 2); g.closePath(); fs(g, '#fff4dc');
      g.beginPath(); g.moveTo(26, -28); g.quadraticCurveTo(14, -26, 14, -6); g.quadraticCurveTo(20, -18, 24, -16); g.quadraticCurveTo(22, -24, 28, -24); g.closePath(); fs(g, accent);   // crin
      poly(g, [28, -28, 30, -38, 34, -29]); fs(g, '#fff4dc');                                               // oreja
      g.fillStyle = INK; circle(g, 36, -21, 2.2); g.fill(); circle(g, 45, -14, 1.4); g.fill();
      g.strokeStyle = '#c8102e'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(42, -11); g.lineTo(22, -3); g.stroke();   // rienda
    },
  };
  // Figura cacheada: caja fw × fh unidades lógicas (≈ 74 % × 66 % de la carta).
  function figure(fig, x, y, fw, fh, accent) {
    const key = 'fig|' + fig + '|' + accent + '|' + fw.toFixed(1);
    blit(sprite(key, fw, fh, (g) => { const k = Math.min(fw / 100, fh / 130); g.scale(k, k); FIG[fig](g, accent); }), x, y, fw, fh);
  }

  // ------------------------------------------------------------------ AS: brillo gigante + angelito y diablillo
  function paintAngel(g) {
    ink(g, 2.4);
    oval(g, -9, 2, 9, 6, -0.5); fs(g, '#ffffff'); oval(g, 9, 2, 9, 6, 0.5); fs(g, '#ffffff');              // alas
    circle(g, 0, 4, 9); fs(g, '#ffd9b8');
    g.strokeStyle = '#ffcc00'; g.lineWidth = 2.6; oval(g, 0, -9, 7, 2.5); g.stroke();                       // aureola
    g.fillStyle = INK; circle(g, -3, 3, 1.4); g.fill(); circle(g, 3, 3, 1.4); g.fill();
    ink(g, 1.6); g.beginPath(); g.arc(0, 6, 3, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  }
  function paintDevilkin(g) {                                          // también es el diablillo de las partículas
    ink(g, 2.4);
    poly(g, [-7, -5, -11, -17, -2, -8]); fs(g, '#ffd23f');
    poly(g, [7, -5, 11, -17, 2, -8]); fs(g, '#ffd23f');
    g.beginPath(); g.moveTo(0, 8); g.quadraticCurveTo(10, 14, 8, 17); g.stroke();
    circle(g, 0, 0, 9); fs(g, '#e8162c');
    g.fillStyle = '#ffe14a'; oval(g, -3.2, -1.5, 2, 1.4, 0.3); g.fill(); oval(g, 3.2, -1.5, 2, 1.4, -0.3); g.fill();
    ink(g, 1.6); g.beginPath(); g.arc(0, 2, 4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  function aceCenter(c, x, y, w, h) {
    const s = w / 60;
    suitIcon(c.suit.symbol, x + 1 * s, y + 2 * s, 17 * s);
    const k = 0.72 * s, d = 26 * k;                                   // compañeros a media altura: no tapan los índices
    blit(sprite('angel|' + k.toFixed(2), d, d, (g) => { g.scale(k, k); paintAngel(g); }), x - 19 * s, y - 6 * s, d, d);
    blit(sprite('devil|' + k.toFixed(2), d, d, (g) => { g.scale(k, k); paintDevilkin(g); }), x + 20 * s, y + 14 * s, d, d);
  }

  // =====================================================================
  //  3. REVERSO: telar de rombos con los colores de la bandera de Quito (azul y rojo)
  // =====================================================================
  const AZUL = '#1c4fa1', ROJO = '#c8102e';
  function paintBack(g, w, h) {
    const x0 = -w / 2, y0 = -h / 2;
    rrOn(g, x0, y0, w, h, 5); g.fillStyle = AZUL; g.fill();                                   // marco azul
    g.save(); rrOn(g, x0 + 3.5, y0 + 3.5, w - 7, h - 7, 3); g.clip();
    g.fillStyle = ROJO; g.fillRect(x0, y0, w, h);
    // rejilla de rombos: alterna azul/rojo como un tejido; hilo blanco en la trama
    const dx = Math.max(7, w / 6), dy = dx * 1.3;
    for (let r = -1, row = 0; r * dy / 2 < h + dy; r++, row++) {
      for (let c = -1, col = 0; c * dx < w + dx; c++, col++) {
        const cx = x0 + c * dx + (row % 2 ? dx / 2 : 0), cy = y0 + r * dy / 2;
        g.beginPath(); g.moveTo(cx, cy - dy / 2); g.lineTo(cx + dx / 2, cy); g.lineTo(cx, cy + dy / 2); g.lineTo(cx - dx / 2, cy); g.closePath();
        g.fillStyle = (row + col) % 2 ? AZUL : ROJO; g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.6; g.stroke();
        if (dx > 8) { g.fillStyle = '#f5c542'; g.fillRect(cx - 0.7, cy - 0.7, 1.4, 1.4); }    // nudo del telar
      }
    }
    g.restore();
    g.strokeStyle = '#f5c542'; g.lineWidth = 1; rrOn(g, x0 + 3.5, y0 + 3.5, w - 7, h - 7, 3); g.stroke();
    // medallón central: rombo azul con filo dorado y sol
    const m = Math.min(w, h) * 0.3;
    g.beginPath(); g.moveTo(0, -m); g.lineTo(m * 0.75, 0); g.lineTo(0, m); g.lineTo(-m * 0.75, 0); g.closePath();
    g.fillStyle = AZUL; g.fill(); g.strokeStyle = '#f5c542'; g.lineWidth = 1.4; g.stroke();
    PAINT.sol(g, m * 0.42, false);
  }
  function drawCardBack(x, y, w, h) { blit(sprite('back|' + w + 'x' + h, w, h, (g) => paintBack(g, w, h)), x, y, w, h); }


  // =====================================================================
  //  4. NAIPE COMPLETO (inclinación opcional c.rot durante el vuelo)
  // =====================================================================
  function cardAt(c, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(x - w / 2 + 1, y - h / 2 + 2.5, w, h, 5); ctx.fill();          // sombra falsa (sin blur)
    if (!c.faceUp) { drawCardBack(x, y, w, h); return; }
    rr(x - w / 2, y - h / 2, w, h, 5); ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.strokeStyle = c.hl ? '#ffd400' : INK; ctx.lineWidth = c.hl ? 3 : 1.3; ctx.stroke();
    const col = c.suit.color, s = w / 60;
    txt(c.rank.label, x - w / 2 + 9 * s, y - h / 2 + 11 * s, 15 * s, col, 'center', '900', false);
    suitIcon(c.suit.symbol, x - w / 2 + 9 * s, y - h / 2 + 25 * s, 6.5 * s);
    if (c.rank.figure) figure(c.rank.figure, x + 3 * s, y + 1 * s, w * 0.7, h * 0.58, col);   // deja libres los índices
    else if (c.rank.id === 'A') aceCenter(c, x + 2 * s, y + 2 * s, w, h);
    else suitIcon(c.suit.symbol, x + 2 * s, y + 5 * s, 17 * s);
    txt(c.rank.label, x + w / 2 - 9 * s, y + h / 2 - 11 * s, 15 * s, col, 'center', '900', false);
  }
  function drawCard(c, w, h) {
    if (c.hidden) return;
    if (c.rot) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); cardAt(c, 0, 0, w, h); ctx.restore(); }
    else cardAt(c, c.x, c.y, w, h);
  }

  // =====================================================================
  //  5. CARTAS DE PUNTOS: PERRO (10) verde manzana y TANTO (2) naranja
  //     El marcador tradicional: 24 puntos = 2 perros + 2 tantos.
  // =====================================================================
  const PERRO_BG = '#7ddc1f', TANTO_BG = '#ff7a00';
  function paintDog(g) {                                     // perrito corriendo con la lengua afuera (caja 100×100)
    ink(g, 3.2);
    g.strokeStyle = 'rgba(26,17,16,0.55)'; g.lineWidth = 3;                                               // líneas de velocidad
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-48, -8 + k * 10); g.lineTo(-38 + k * 2, -8 + k * 10); g.stroke(); }
    ink(g, 3.2);
    g.beginPath(); g.moveTo(-28, 2); g.quadraticCurveTo(-42, -6, -40, -22); g.stroke();                    // cola
    const leg = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); ink(g, 9); g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.stroke(); };
    leg(-18, 14, -36, 30); leg(-10, 16, -20, 36); leg(14, 14, 32, 28); leg(20, 12, 38, 18);                 // patas en carrera
    ink(g, 3.2); oval(g, -2, 6, 28, 15); fs(g, '#ffffff');
    oval(g, -8, 0, 10, 7); g.fillStyle = '#a0612a'; g.fill();                                              // mancha
    g.beginPath(); g.moveTo(12, -2); g.lineTo(18, 6); g.strokeStyle = '#d7141f'; g.lineWidth = 4; g.stroke();  // collar
    ink(g, 3.2); circle(g, 26, -12, 15); fs(g, '#ffffff');
    oval(g, 18, -20, 7, 12, 0.5); fs(g, '#a0612a');                                                        // oreja al viento
    oval(g, 39, -6, 10, 7); fs(g, '#ffffff');                                                              // hocico
    g.beginPath(); g.moveTo(36, 0); g.quadraticCurveTo(38, 16, 44, 14); g.quadraticCurveTo(48, 10, 42, 0); g.closePath(); fs(g, '#ff6f91');   // lengua
    g.fillStyle = INK; circle(g, 47, -9, 3.5); g.fill();
    circle(g, 29, -15, 5); g.fillStyle = '#fff'; g.fill(); g.stroke(); g.fillStyle = INK; circle(g, 31, -15, 2.4); g.fill();
  }
  function paintPointCard(g, kind, w, h) {
    const big = h >= 56;
    rrOn(g, -w / 2, -h / 2, w, h, Math.max(2, w * 0.1)); g.fillStyle = kind === 'perro' ? PERRO_BG : TANTO_BG; g.fill();
    g.strokeStyle = INK; g.lineWidth = Math.max(1, w * 0.05); g.stroke();
    const inset = w * 0.09;
    rrOn(g, -w / 2 + inset, -h / 2 + inset, w - 2 * inset, h - 2 * inset, w * 0.06); g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(0.8, w * 0.03); g.stroke();
    if (kind === 'perro') {
      g.save(); const k = (w * 0.86) / 100; g.translate(0, big ? 0 : h * 0.04); g.scale(k, k); paintDog(g); g.restore();
      if (big) {
        g.font = `900 ${h * 0.14}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = h * 0.03; g.strokeStyle = INK; g.fillStyle = '#ffffff';
        g.strokeText('10', 0, -h * 0.33); g.fillText('10', 0, -h * 0.33);
        g.font = `900 ${h * 0.085}px system-ui, sans-serif`; g.strokeText('PERRO', 0, h * 0.36); g.fillText('PERRO', 0, h * 0.36);
      }
    } else {
      const r = w * 0.3;
      circle(g, 0, 0, r); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(1, w * 0.04); g.stroke();
      g.font = `900 ${r * 1.5}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = TANTO_BG; g.lineWidth = Math.max(1, r * 0.12); g.strokeText('2', 0, r * 0.08); g.fillText('2', 0, r * 0.08);
      if (big) {                                                         // borde con la frase (solo legible en grande)
        g.fillStyle = '#ffffff'; g.font = `800 ${h * 0.062}px system-ui, sans-serif`;
        g.fillText('caída por guapo', 0, -h / 2 + inset + h * 0.08);
        g.fillText('dos por shunsho', 0, h / 2 - inset - h * 0.08);
        g.fillStyle = '#ffd23f';                                         // estrellitas decorativas
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circle(g, sx * (w / 2 - inset * 2.2), sy * (h * 0.2), w * 0.035); g.fill(); }
      }
    }
  }
  // (sw, sh) = tamaño al que se pinta el sprite; (w, h) = tamaño en pantalla. Para animaciones de escala se pasa
  // siempre el mismo (sw, sh): un solo sprite reescalado por drawImage, no uno por fotograma.
  function drawPointCard(kind, x, y, w, h, sw = w, sh = h) {
    const key = 'pts|' + kind + '|' + sw + 'x' + sh;
    blit(sprite(key, sw, sh, (g) => paintPointCard(g, kind, sw, sh)), x, y, w, h);
  }
  const markers = (score) => ({ perros: Math.floor(score / 10), tantos: Math.floor((score % 10) / 2) });
  // Marcador en abanico: perros primero y luego tantos. dir = 1 crece a la derecha, -1 a la izquierda.
  function drawScoreMarkers(score, x, y, dir) {
    const m = markers(score), w = 15, h = 21, step = 8;
    let cx = x;
    for (let i = 0; i < m.perros; i++, cx += dir * step) drawPointCard('perro', cx, y, w, h);
    if (m.perros) cx += dir * 8;
    for (let i = 0; i < m.tantos; i++, cx += dir * step) drawPointCard('tanto', cx, y, w, h);
  }


  // =====================================================================
  //  6. RETRATOS, ESCENARIOS Y PAÑO (sin cambios de diseño respecto a v1.0.0)
  // =====================================================================
  function drawPortrait(rival, x, y, s, t) {
    const k = rival.colors;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
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
        ctx.fillStyle = '#1b1b1b'; ctx.fillRect(-5, 0, 10, 2);
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
        ctx.fillStyle = '#1a0505'; ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(0, 17); ctx.lineTo(4, 9); ctx.fill();
      }
    }
    ctx.restore();
  }

  const PENNANTS = ['#c0392b', '#2e86c1', '#f1c40f', '#ffffff'];
  function pennants(t, sag, len) {
    for (let k = 0; k < 16; k++) {
      const x = 8 + k * 23, y = 6 + Math.sin(k / 15 * Math.PI) * sag;
      ctx.fillStyle = PENNANTS[k % 4]; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x + Math.sin(t * 3 + k) * 1.5, y + len); ctx.fill();
    }
  }
  function drawScene(rival, t) {
    if ((CU.CFG && CU.CFG.FONDO) !== 'rival') {                // el horizonte de Quito ya está en el paño
      if (rival.id === 'cantuna') { ctx.fillStyle = `rgba(255,90,20,${0.10 + 0.06 * Math.sin(t * 2.2)})`; ctx.fillRect(0, 140, W, 20); }   // brasas en el atrio
      pennants(t, 8, 11);
      return;
    }
    const sc = rival.scene;
    const g = ctx.createLinearGradient(0, 0, 0, 92); g.addColorStop(0, sc.sky[0]); g.addColorStop(1, sc.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 92);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    if (rival.id === 'chulla') { for (let x = 0; x < W; x += 44) { ctx.fillRect(x, 50, 40, 42); ctx.fillStyle = 'rgba(255,200,80,0.6)'; ctx.fillRect(x + 8, 62, 8, 10); ctx.fillRect(x + 24, 62, 8, 10); ctx.fillStyle = 'rgba(0,0,0,0.55)'; } }
    if (rival.id === 'gallo') { ctx.fillRect(60, 44, 240, 48); ctx.beginPath(); ctx.moveTo(150, 44); ctx.lineTo(180, 20); ctx.lineTo(210, 44); ctx.fill(); ctx.fillRect(176, 8, 8, 14); }
    if (rival.id === 'almeida') { ctx.fillRect(40, 52, 280, 40); for (let x = 50; x < 320; x += 30) { ctx.fillStyle = 'rgba(20,30,60,0.9)'; ctx.beginPath(); ctx.arc(x + 12, 70, 9, Math.PI, TAU); ctx.fillRect(x + 3, 70, 18, 22); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; } }
    if (rival.id === 'cantuna') {
      // resplandor de brasas que respira bajo el atrio
      ctx.fillStyle = `rgba(255,90,20,${0.18 + 0.08 * Math.sin(t * 2.2)})`; ctx.fillRect(0, 70, W, 22);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(70, 40, 220, 52); ctx.fillRect(84, 18, 26, 26); ctx.fillRect(250, 18, 26, 26); ctx.beginPath(); ctx.moveTo(84, 18); ctx.lineTo(97, 4); ctx.lineTo(110, 18); ctx.moveTo(250, 18); ctx.lineTo(263, 4); ctx.lineTo(276, 18); ctx.fill();
    }
    pennants(t, 8, 11);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 92, W, 2);
  }
  // =====================================================================
  //  6b. FONDO: CENTRO HISTÓRICO DE QUITO fundido con el paño
  //      Se pinta UNA vez en el paño pre-renderizado: costo por fotograma = 0.
  //      Franja visible y≈18–150 (entre los banderines y la mano del rival); de 135 a 215 se funde al verde.
  // =====================================================================
  const NIGHT = { top: '#070d24', mid: '#14204a', low: '#22346a', hill: '#0d1631', city: '#0a1128', rim: '#3a5296', lamp: '#f5c542' };

  function paintSky(f) {
    const g = f.createLinearGradient(0, 0, 0, 220);
    g.addColorStop(0, NIGHT.top); g.addColorStop(0.55, NIGHT.mid); g.addColorStop(1, NIGHT.low);
    f.fillStyle = g; f.fillRect(0, 0, W, 220);
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);   // estrellas siempre iguales
    for (let i = 0; i < 46; i++) { f.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.5})`; f.fillRect(rnd() * W, 22 + rnd() * 70, rnd() < 0.15 ? 1.6 : 1, rnd() < 0.15 ? 1.6 : 1); }
  }

  // El Panecillo: loma suave a la derecha, detrás de la iglesia.
  const PANECILLO = { x: 286, y: 64 };
  function paintPanecillo(f) {
    f.beginPath(); f.moveTo(150, 160);
    f.bezierCurveTo(200, 150, 238, 74, PANECILLO.x, PANECILLO.y);
    f.bezierCurveTo(318, 58, 340, 92, W + 10, 118);
    f.lineTo(W + 10, 170); f.closePath();
    f.fillStyle = NIGHT.hill; f.fill();
    f.strokeStyle = NIGHT.rim; f.lineWidth = 1.2; f.stroke();                            // línea limpia de contorno
  }

  // Virgen del Panecillo: silueta alada simplificada, trazo plateado y halo tenue.
  function paintVirgen(f, cx, by) {
    const halo = f.createRadialGradient(cx, by - 18, 2, cx, by - 18, 30);
    halo.addColorStop(0, 'rgba(210,225,255,0.42)'); halo.addColorStop(1, 'rgba(210,225,255,0)');
    f.fillStyle = halo; f.beginPath(); f.arc(cx, by - 18, 30, 0, TAU); f.fill();
    const silver = f.createLinearGradient(cx - 14, 0, cx + 14, 0);
    silver.addColorStop(0, '#8e9bb2'); silver.addColorStop(0.5, '#f1f5fb'); silver.addColorStop(1, '#9aa7bd');
    f.fillStyle = silver; f.strokeStyle = 'rgba(255,255,255,0.85)'; f.lineWidth = 0.7; f.lineJoin = 'round';
    // alas (dos curvas abiertas hacia arriba)
    for (const side of [-1, 1]) {
      f.beginPath(); f.moveTo(cx + side * 2, by - 22);
      f.quadraticCurveTo(cx + side * 13, by - 34, cx + side * 15, by - 27);
      f.quadraticCurveTo(cx + side * 11, by - 22, cx + side * 9, by - 15);
      f.quadraticCurveTo(cx + side * 6, by - 18, cx + side * 2, by - 17); f.closePath(); f.fill(); f.stroke();
    }
    // manto acampanado con leve giro (danza) y cabeza
    f.beginPath(); f.moveTo(cx - 2.5, by - 24);
    f.quadraticCurveTo(cx - 7, by - 12, cx - 6, by - 3); f.lineTo(cx + 7, by - 3);
    f.quadraticCurveTo(cx + 4, by - 13, cx + 2.5, by - 24); f.closePath(); f.fill(); f.stroke();
    f.beginPath(); f.arc(cx, by - 27, 2.6, 0, TAU); f.fill(); f.stroke();
    f.fillStyle = '#f5e7a8';                                                                // corona de estrellas
    for (let k = -2; k <= 2; k++) { f.beginPath(); f.arc(cx + k * 2.2, by - 31.5 - (2 - Math.abs(k)) * 0.6, 0.55, 0, TAU); f.fill(); }
    f.fillStyle = '#5d6b85'; f.beginPath(); f.ellipse(cx, by - 2, 7, 2.2, 0, 0, TAU); f.fill();   // pedestal
  }

  // Casas coloniales bajas a lo largo del horizonte, con ventanas encendidas.
  function paintCasas(f) {
    let seed = 3; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let x = -6; x < W; ) {
      const w = 22 + rnd() * 20, h = 14 + rnd() * 14, y = 152 - h;
      if (x > 76 && x < 232) { x += w; continue; }                                        // hueco para la iglesia
      f.fillStyle = NIGHT.city; f.fillRect(x, y, w, h + 20);
      f.fillStyle = '#121b3c'; f.beginPath(); f.moveTo(x - 2, y); f.lineTo(x + w / 2, y - 6); f.lineTo(x + w + 2, y); f.fill();   // tejado
      f.strokeStyle = NIGHT.rim; f.lineWidth = 0.8; f.strokeRect(x + 0.5, y + 0.5, w - 1, h + 19);
      f.fillStyle = 'rgba(245,197,66,0.55)';
      for (let wx = x + 4; wx < x + w - 6; wx += 8) if (rnd() < 0.55) f.fillRect(wx, y + 5, 3, 4);
      x += w;
    }
  }

  // Iglesia y convento de San Francisco: fachada de piedra, dos torres simétricas, cúpula, atrio con gradas.
  function paintSanFrancisco(f) {
    const L = 92, R = 218, cx = (L + R) / 2, base = 150;
    // cúpulas detrás, iluminadas sutilmente
    for (const [dx, r] of [[0, 17], [-34, 9], [34, 9]]) {
      const x = cx + dx, y = 70 + (r === 17 ? 0 : 10);
      const g = f.createLinearGradient(x - r, y - r, x + r, y);
      g.addColorStop(0, '#2a3d78'); g.addColorStop(1, NIGHT.city);
      f.fillStyle = g; f.beginPath(); f.arc(x, y, r, Math.PI, TAU); f.fill();
      f.strokeStyle = 'rgba(245,197,66,0.45)'; f.lineWidth = 1; f.beginPath(); f.arc(x, y, r, Math.PI * 1.08, Math.PI * 1.55); f.stroke();
      f.fillStyle = NIGHT.city; f.fillRect(x - 2, y - r - 7, 4, 7);                        // linterna
      f.fillStyle = 'rgba(245,197,66,0.6)'; f.fillRect(x - 1, y - r - 5, 2, 3);
    }
    // cuerpo central (fachada)
    f.fillStyle = '#101a3a'; f.fillRect(L + 24, 76, R - L - 48, base - 76);
    f.strokeStyle = NIGHT.rim; f.lineWidth = 1.2; f.strokeRect(L + 24.5, 76.5, R - L - 49, base - 76);
    // frontón escalonado y balaustrada
    f.fillStyle = '#101a3a'; f.beginPath(); f.moveTo(L + 24, 76); f.lineTo(cx - 14, 76); f.lineTo(cx - 14, 66); f.lineTo(cx + 14, 66); f.lineTo(cx + 14, 76); f.lineTo(R - 24, 76); f.closePath(); f.fill(); f.stroke();
    f.strokeStyle = 'rgba(58,82,150,0.8)'; f.lineWidth = 0.8;
    for (let x = L + 28; x < R - 24; x += 5) { f.beginPath(); f.moveTo(x, 79); f.lineTo(x, 84); f.stroke(); }
    // columnas pareadas y portada con arco
    for (const x of [cx - 26, cx - 20, cx + 20, cx + 26]) { f.beginPath(); f.moveTo(x, 92); f.lineTo(x, base - 6); f.stroke(); }
    f.fillStyle = 'rgba(245,197,66,0.28)'; f.beginPath(); f.moveTo(cx - 11, base - 6); f.lineTo(cx - 11, 112); f.arc(cx, 112, 11, Math.PI, TAU); f.lineTo(cx + 11, base - 6); f.closePath(); f.fill();
    f.strokeStyle = NIGHT.rim; f.lineWidth = 1; f.stroke();
    f.fillStyle = 'rgba(245,197,66,0.4)'; f.beginPath(); f.arc(cx, 95, 5, 0, TAU); f.fill();   // ventana circular del coro
    // torres simétricas: cuerpo, campanario con arcos y remate
    for (const tx of [L, R - 26]) {
      f.fillStyle = '#0f1836'; f.fillRect(tx, 46, 26, base - 46);
      f.strokeStyle = NIGHT.rim; f.lineWidth = 1.2; f.strokeRect(tx + 0.5, 46.5, 25, base - 46);
      f.fillStyle = 'rgba(245,197,66,0.42)';
      for (const ax of [tx + 6, tx + 15]) { f.beginPath(); f.moveTo(ax, 64); f.lineTo(ax, 56); f.arc(ax + 2.5, 56, 2.5, Math.PI, TAU); f.lineTo(ax + 5, 64); f.closePath(); f.fill(); }
      f.fillStyle = '#0f1836'; f.beginPath(); f.moveTo(tx - 1, 46); f.lineTo(tx + 13, 36); f.lineTo(tx + 27, 46); f.closePath(); f.fill(); f.stroke();
      f.beginPath(); f.arc(tx + 13, 34, 3.5, Math.PI, TAU); f.fill(); f.stroke();
      f.strokeStyle = '#c9d3e6'; f.lineWidth = 1; f.beginPath(); f.moveTo(tx + 13, 31); f.lineTo(tx + 13, 23); f.moveTo(tx + 10, 26); f.lineTo(tx + 16, 26); f.stroke();   // cruz
      f.strokeStyle = 'rgba(58,82,150,0.7)'; f.beginPath(); f.moveTo(tx, 68); f.lineTo(tx + 26, 68); f.moveTo(tx, 100); f.lineTo(tx + 26, 100); f.stroke();       // cornisas
    }
    // atrio: gradas anchas (rasgo del atrio de San Francisco)
    for (let i = 0; i < 3; i++) {
      f.fillStyle = i % 2 ? '#13204a' : '#0f1a3c';
      f.fillRect(L - 18 - i * 8, base + i * 4, R - L + 36 + i * 16, 4);
      f.strokeStyle = 'rgba(58,82,150,0.6)'; f.lineWidth = 0.6; f.strokeRect(L - 18 - i * 8 + 0.5, base + i * 4 + 0.5, R - L + 35 + i * 16, 3);
    }
  }

  function paintQuito(f) {
    paintSky(f);
    paintPanecillo(f);
    paintVirgen(f, PANECILLO.x, PANECILLO.y);
    paintCasas(f);
    paintSanFrancisco(f);
  }

  function buildFelt(tableTop, tableBottom) {      // paño pre-renderizado una sola vez
    const make = () => { const c = document.createElement('canvas'); c.width = Math.ceil(W * RES); c.height = Math.ceil(H * RES); const x = c.getContext('2d'); x.scale(RES, RES); return [c, x]; };
    const [felt, f] = make();
    // capa del paño
    const [cloth, k] = make();
    const g = k.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * 0.7);
    g.addColorStop(0, '#1a7a4c'); g.addColorStop(1, '#073a22');
    k.fillStyle = g; k.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { k.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`; k.fillRect(Math.random() * W, Math.random() * H, 1, 1); }
    if ((CU.CFG && CU.CFG.FONDO) !== 'rival') {
      paintQuito(f);
      // el paño aparece con un degradado vertical: transparente sobre la ciudad, opaco desde la mesa
      const m = k.createLinearGradient(0, 135, 0, 215);
      m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
      k.globalCompositeOperation = 'destination-in'; k.fillStyle = m; k.fillRect(0, 0, W, H);
      k.globalCompositeOperation = 'source-over';
    }
    f.setTransform(1, 0, 0, 1, 0, 0); f.drawImage(cloth, 0, 0); f.setTransform(RES, 0, 0, RES, 0, 0);
    f.strokeStyle = 'rgba(245,197,66,0.25)'; f.lineWidth = 1.5; f.setLineDash([4, 4]);
    f.strokeRect(14, tableTop - 18, W - 28, tableBottom - tableTop + 36);
    return felt;
  }


  // =====================================================================
  //  6c. PANTALLA DE VICTORIA: cartel de cómic, copas de canelazo brindando, confeti y serpentinas
  //      Solo cuando gana el jugador. Pool fijo (sin asignar memoria por fotograma).
  // =====================================================================
  const FIESTA = ['#e8162c', '#ffd23f', '#1c4fa1', '#ffffff', '#2fbf71', '#ff8a1f'];
  const Victory = (() => {
    const conf = Array.from({ length: 90 }, () => ({}));
    const serp = Array.from({ length: 7 }, () => ({}));
    let on = false, t = 0;
    const r = (a, b) => a + Math.random() * (b - a);
    function seedConf(c, top) {
      c.x = r(0, W); c.y = top ? r(-H * 0.6, -10) : r(0, H); c.vy = r(45, 95); c.ph = r(0, TAU);
      c.rot = r(0, TAU); c.vr = r(-6, 6); c.w = r(4, 7); c.h = r(2, 4); c.col = FIESTA[(Math.random() * FIESTA.length) | 0];
    }
    function seedSerp(sp, top) {
      sp.x = r(10, W - 10); sp.y = top ? r(-260, -60) : r(-60, H * 0.6); sp.v = r(28, 48); sp.amp = r(6, 12);
      sp.len = r(70, 110); sp.ph = r(0, TAU); sp.col = FIESTA[(Math.random() * FIESTA.length) | 0];
    }
    return {
      start() { on = true; t = 0; conf.forEach((c) => seedConf(c, false)); serp.forEach((sp) => seedSerp(sp, false)); },
      stop() { on = false; },
      isOn: () => on,
      update(dt) {
        if (!on) return;
        t += dt;
        for (const c of conf) { c.y += c.vy * dt; c.x += Math.sin(t * 2 + c.ph) * 22 * dt; c.rot += c.vr * dt; if (c.y > H + 10) seedConf(c, true); }
        for (const sp of serp) { sp.y += sp.v * dt; if (sp.y - sp.len > H) seedSerp(sp, true); }
      },
      // Confeti y serpentinas, siempre DETRÁS del cartel: nunca tapan la frase.
      drawParticles() {
        if (!on) return;
        ctx.lineCap = 'round';
        serp.forEach((sp) => {
          ctx.strokeStyle = sp.col; ctx.lineWidth = 3; ctx.beginPath();
          for (let k = 0; k <= 20; k++) {
            const yy = sp.y - (k / 20) * sp.len, xx = sp.x + Math.sin(k * 0.6 + t * 4 + sp.ph) * sp.amp;
            if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
          }
          ctx.stroke();
        });
        const base = ctx.getTransform();
        conf.forEach((c) => {
          ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.scale(1, Math.abs(Math.cos(t * 5 + c.ph)) * 0.8 + 0.2);   // giro 3D aparente
          ctx.fillStyle = c.col; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
          ctx.setTransform(base);
        });
      },
      time: () => t,
    };
  })();

  // Estallido de cómic detrás del título.
  function burst(cx, cy, r1, r2, n, color, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i * Math.PI) / n, rr = i % 2 ? r2 : r1;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.62;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
  }
  // Texto de cómic: tinta gruesa + sombra desplazada + relleno.
  function comicText(str, x, y, size, fill, shadow) {
    ctx.font = `italic 900 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = INK;
    ctx.strokeText(str, x + size * 0.07, y + size * 0.07); ctx.fillStyle = shadow; ctx.fillText(str, x + size * 0.07, y + size * 0.07);
    ctx.strokeText(str, x, y); ctx.fillStyle = fill; ctx.fillText(str, x, y);
  }

  // Copa de canelazo: cáliz, tallo, pie; canelazo naranja con fondo de canela, rama de canela y vapor.
  function paintCopa(g) {
    ink(g, 3);
    g.beginPath(); g.moveTo(-26, -40); g.lineTo(26, -40); g.quadraticCurveTo(24, -2, 4, 6); g.lineTo(-4, 6); g.quadraticCurveTo(-24, -2, -26, -40); g.closePath();
    fs(g, 'rgba(225,240,255,0.92)');
    g.save(); g.clip();
    const liq = g.createLinearGradient(0, -30, 0, 6);
    liq.addColorStop(0, '#ffb347'); liq.addColorStop(0.45, '#ff8a1f'); liq.addColorStop(1, '#b8562a');
    g.fillStyle = liq; g.fillRect(-30, -28, 60, 40);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-22, -28, 44, 3);                     // brillo en la superficie
    g.restore();
    ink(g, 3); g.beginPath(); g.moveTo(-26, -40); g.lineTo(26, -40); g.quadraticCurveTo(24, -2, 4, 6); g.lineTo(-4, 6); g.quadraticCurveTo(-24, -2, -26, -40); g.closePath(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-15, -22, 3, 9, 0.2, 0, TAU); g.fill();   // reflejo del vidrio
    g.beginPath(); g.rect(-3, 6, 6, 26); fs(g, 'rgba(225,240,255,0.92)');                     // tallo
    g.beginPath(); g.ellipse(0, 34, 18, 5, 0, 0, TAU); fs(g, 'rgba(225,240,255,0.92)');       // pie
    ink(g, 2.5); g.beginPath(); g.rect(8, -58, 6, 34); fs(g, '#8a4b22');                        // rama de canela
    g.strokeStyle = '#5c2f12'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(11, -56); g.lineTo(11, -26); g.stroke();
  }

  // Cartel completo de victoria. phrase = frase quiteña literal; score = «40 – 22».
  function drawVictoryPoster(phrase, score, titleLines) {
    const t = Victory.time();
    Victory.drawParticles();
    // título gigante de cómic sobre un estallido
    burst(W / 2, 112, 168, 132, 14, '#e8162c', t * 0.15);
    burst(W / 2, 112, 140, 112, 14, '#ffd23f', -t * 0.1);
    ctx.save(); ctx.translate(W / 2, 112); ctx.rotate(-0.06 + Math.sin(t * 2) * 0.015);
    const pop = 1 + Math.max(0, 0.25 - t) * 1.6;                                               // entrada con rebote
    ctx.scale(pop, pop);
    comicText(titleLines[0], 0, -20, 40, '#ffffff', '#ff8a1f');
    comicText(titleLines[1], 0, 24, 46, '#ffd23f', '#e8162c');
    ctx.restore();
    // dos copas de canelazo brindando: se acercan, chocan («¡chin!») y se separan
    const cyc = (t * 0.9) % 1, near = cyc < 0.5 ? Math.sin(cyc * Math.PI * 2) : 0;   // 0 → 1 → 0 y pausa
    const gap = 46 - near * 24, tilt = 0.18 + near * 0.12;
    const copa = sprite('copa', 70, 110, (g) => { g.translate(0, 8); paintCopa(g); });
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(W / 2 + side * gap, 262); ctx.rotate(-side * tilt);
      // vapor del canelazo caliente
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) { const x = -8 + k * 12, w = Math.sin(t * 3 + k + side) * 3; ctx.beginPath(); ctx.moveTo(x, -42); ctx.quadraticCurveTo(x - 4 + w, -52, x + w, -60); ctx.quadraticCurveTo(x + 4 + w, -68, x + w, -76); ctx.stroke(); }
      ctx.drawImage(copa, -35, -55, 70, 110);
      ctx.restore();
    }
    if (near > 0.85) {                                                                          // destello del choque
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * 10, 224 + Math.sin(a) * 10); ctx.lineTo(W / 2 + Math.cos(a) * 20, 224 + Math.sin(a) * 20); ctx.stroke(); }
      comicText('¡CHIN!', W / 2, 196, 16, '#ffffff', '#e8162c');
    }
    // la frase quiteña, literal y destacada
    ctx.font = '800 16px system-ui, "Segoe UI", Roboto, sans-serif';
    const lines = wrapLines(phrase, 280, '800 16px system-ui, "Segoe UI", Roboto, sans-serif');
    const ph = 20 + lines.length * 21;
    rr(26, 330, W - 52, ph, 12); ctx.fillStyle = '#fff8e7'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    rr(26, 330, W - 52, ph, 12); ctx.strokeStyle = '#e8162c'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    lines.forEach((ln, i) => txt(ln, W / 2, 330 + 20 + i * 21, 16, '#7a1020', 'center', '800', false));
    txt(score, W / 2, 330 + ph + 24, 22, '#ffffff', 'center', '900');
  }

  // =====================================================================
  //  7. «DIABLILLOS DE CANTUÑA»: sistema de partículas con pool fijo
  //     type 0 = chispa roja/amarilla con estela · type 1 = diablillo (círculo + dos triángulos por cuernos)
  //     Flotan hacia arriba, rotan y se desvanecen (alfa). Sin asignar memoria por frame.
  // =====================================================================
  class ParticleSystem {
    constructor(max) {
      this.max = max; this.alive = 0; this.clock = 0; this.accImp = 0; this.accSpark = 0;
      this.pool = Array.from({ length: max }, () => ({ on: false, type: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, ttl: 1, size: 1, rot: 0, vr: 0, ph: 0, hue: 0 }));
    }
    spawn(type, x, y) {
      for (const p of this.pool) {
        if (p.on) continue;
        p.on = true; p.type = type; p.x = x; p.y = y; p.ph = Math.random() * TAU; p.hue = Math.random();
        if (type === 0) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, v = 40 + Math.random() * 90;
          p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.ttl = p.life = 0.5 + Math.random() * 0.6; p.size = 1 + Math.random() * 1.4;
        } else {
          p.vx = (Math.random() - 0.5) * 20; p.vy = -(22 + Math.random() * 26); p.ttl = p.life = 1.6 + Math.random() * 1.2;
          p.size = 0.6 + Math.random() * 0.6; p.rot = (Math.random() - 0.5) * 0.4; p.vr = (Math.random() - 0.5) * 2.4;
        }
        this.alive++;
        return p;
      }
      return null;                                       // pool lleno: se descarta, nunca crece
    }
    // Ráfaga en (x, y): n diablillos + m chispas.
    burst(x, y, n = 6, m = 24) {
      for (let i = 0; i < n; i++) { const p = this.spawn(1, x + (Math.random() - 0.5) * 150, y + (Math.random() - 0.5) * 50); if (p) { p.vx = (Math.random() - 0.5) * 70; p.vy -= 20; } }
      for (let i = 0; i < m; i++) this.spawn(0, x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 10);
    }
    // Emisión ambiental continua desde el borde inferior del rectángulo r (tasas por segundo).
    emit(dt, r, impRate, sparkRate) {
      this.accImp += impRate * dt; this.accSpark += sparkRate * dt;
      while (this.accImp >= 1) { this.accImp--; this.spawn(1, r.x + Math.random() * r.w, r.y + r.h); }
      while (this.accSpark >= 1) { this.accSpark--; this.spawn(0, r.x + Math.random() * r.w, r.y + r.h - Math.random() * 6); }
    }
    update(dt) {
      if (!this.alive) return;
      this.clock += dt;
      for (const p of this.pool) {
        if (!p.on) continue;
        if ((p.life -= dt) <= 0) { p.on = false; this.alive--; continue; }
        if (p.type === 0) { p.vx *= 1 - 1.8 * dt; p.vy = p.vy * (1 - 1.2 * dt) - 30 * dt; }                 // arrastre + flotación
        else { p.vx += Math.sin(this.clock * 3 + p.ph) * 40 * dt; p.vx *= 1 - 1.5 * dt; p.rot += p.vr * dt; } // vaivén y giro
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    draw() {
      if (!this.alive) return;
      const base = ctx.getTransform();
      const imp = sprite('imp', 34, 48, (g) => { g.scale(1.4, 1.4); paintDevilkin(g); });
      for (const p of this.pool) {
        if (!p.on || p.type !== 1) continue;
        ctx.globalAlpha = Math.min(1, (p.ttl - p.life) / 0.25) * Math.pow(p.life / p.ttl, 0.8);              // entra y se desvanece
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.size, p.size);
        ctx.drawImage(imp, -17, -24, 34, 48);
        ctx.setTransform(base);
      }
      ctx.lineCap = 'round';
      for (const p of this.pool) {
        if (!p.on || p.type !== 0) continue;
        ctx.globalAlpha = (p.life / p.ttl) * (0.7 + 0.3 * Math.sin(this.clock * 30 + p.ph));                   // parpadeo
        ctx.strokeStyle = p.hue < 0.5 ? '#ff2a12' : '#ffe14a'; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    clear() { for (const p of this.pool) p.on = false; this.alive = 0; this.accImp = this.accSpark = 0; }
    count() { return this.alive; }
  }
  const Imps = new ParticleSystem(80);

  // =====================================================================
  //  API
  // =====================================================================
  CU.Draw = {
    attach(context, w, h) { ctx = context; W = w; H = h; },
    // Llamar en cada resize: invalida los sprites para repintarlos nítidos a la nueva densidad.
    setResolution(k) { if (Math.abs(k - RES) > 0.01) { RES = k; cache.clear(); } },
    cacheSize: () => cache.size,
    txt, rr, wrapLines, button, suitIcon, drawCardBack, drawCard, drawPortrait, drawScene, pennants, buildFelt,
    drawPointCard, drawScoreMarkers, markers, ParticleSystem, Imps, Victory, drawVictoryPoster,
  };
})(window.CU);
