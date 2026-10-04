/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: js/draw.js — Primitivas de dibujo, naipes quiteños, escenarios y partículas («diablillos»)
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.1.0
 */
/*
 * Rendimiento (objetivo 60 FPS en gama baja):
 *  - Palos, figuras, reversos y el diablillo se pintan UNA vez en canvas fuera de pantalla (sprites) a la
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
    txt(label, r.x + r.w / 2, r.y + r.h / 2, 12, primary ? '#2b1a08' : '#fff', 'center', '800', false);
  }

  // =====================================================================
  //  1. LOS CUATRO BRILLOS QUITEÑOS (vectores puros, origen en el centro, radio ≈ s)
  //     `detail` activa ornamentos solo cuando el icono es grande (nivel de detalle).
  // =====================================================================
  const PAINT = {
    // Sol incásico: dos coronas concéntricas de rayos (largos y cortos alternados) + disco con anillos
    sol(g, s, detail) {
      const gold = g.createRadialGradient(-s * 0.15, -s * 0.15, s * 0.05, 0, 0, s);
      gold.addColorStop(0, '#fff6c2'); gold.addColorStop(0.45, '#f6c21c'); gold.addColorStop(1, '#b97800');
      g.fillStyle = gold;
      for (let k = 0; k < 16; k++) {
        const a = k * TAU / 16, long = k % 2 === 0, r0 = s * 0.46, r1 = s * (long ? 1 : 0.76), half = long ? 0.13 : 0.17;
        g.beginPath();
        g.moveTo(Math.cos(a - half) * r0, Math.sin(a - half) * r0);
        g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        g.lineTo(Math.cos(a + half) * r0, Math.sin(a + half) * r0);
        g.closePath(); g.fill();
      }
      g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.fill();
      g.strokeStyle = '#9a6200'; g.lineWidth = s * 0.07;
      g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.stroke();
      g.lineWidth = s * 0.04; g.beginPath(); g.arc(0, 0, s * 0.36, 0, TAU); g.stroke();
      if (detail) {                                            // rostro del Inti
        g.fillStyle = '#7a4a00';
        g.beginPath(); g.ellipse(-s * 0.13, -s * 0.07, s * 0.05, s * 0.035, 0, 0, TAU); g.ellipse(s * 0.13, -s * 0.07, s * 0.05, s * 0.035, 0, 0, TAU); g.fill();
        g.lineWidth = s * 0.035; g.beginPath(); g.moveTo(0, -s * 0.05); g.lineTo(0, s * 0.08); g.stroke();
        g.beginPath(); g.arc(0, s * 0.1, s * 0.12, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      }
    },
    // Corazón carmesí con ventanal ojival gótico (Basílica del Voto Nacional) y cruz
    corazon(g, s, detail) {
      const red = g.createRadialGradient(-s * 0.35, -s * 0.35, s * 0.05, 0, 0, s * 1.1);
      red.addColorStop(0, '#ff6a7d'); red.addColorStop(0.5, '#b3122e'); red.addColorStop(1, '#640616');
      g.beginPath(); g.moveTo(0, s * 0.82);
      g.bezierCurveTo(-s * 1.15, s * 0.02, -s * 0.62, -s * 0.95, 0, -s * 0.38);
      g.bezierCurveTo(s * 0.62, -s * 0.95, s * 1.15, s * 0.02, 0, s * 0.82);
      g.closePath(); g.fillStyle = red; g.fill();
      g.strokeStyle = '#4e0410'; g.lineWidth = s * 0.06; g.stroke();
      g.strokeStyle = '#f5d76e';
      if (detail) {
        // arco ojival (lanceta) con parteluz y rosetón
        const w = s * 0.24, base = s * 0.42, spring = s * 0.0, apex = -s * 0.3;
        g.lineWidth = s * 0.05;
        g.beginPath(); g.moveTo(-w, base); g.lineTo(-w, spring);
        g.quadraticCurveTo(-w, apex + s * 0.1, 0, apex); g.quadraticCurveTo(w, apex + s * 0.1, w, spring); g.lineTo(w, base); g.stroke();
        g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(0, -s * 0.06); g.lineTo(0, base); g.stroke();
        g.beginPath(); g.arc(0, -s * 0.12, s * 0.07, 0, TAU); g.stroke();
      }
      g.fillStyle = '#f5d76e';                                 // cruz sobre el ápice
      g.fillRect(-s * 0.035, -s * 0.62, s * 0.07, s * 0.26); g.fillRect(-s * 0.11, -s * 0.55, s * 0.22, s * 0.06);
      g.fillStyle = 'rgba(255,255,255,0.35)';                  // brillo
      g.beginPath(); g.ellipse(-s * 0.42, -s * 0.22, s * 0.12, s * 0.07, -0.7, 0, TAU); g.fill();
    },
    // Espada militar de hoja delgada con guarnición dorada cruzada
    espada(g, s) {
      const steel = g.createLinearGradient(-s * 0.1, 0, s * 0.1, 0);
      steel.addColorStop(0, '#5d6d82'); steel.addColorStop(0.5, '#f4f7fb'); steel.addColorStop(1, '#7e8fa5');
      g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.085, -s * 0.8); g.lineTo(s * 0.085, s * 0.32); g.lineTo(-s * 0.085, s * 0.32); g.lineTo(-s * 0.085, -s * 0.8); g.closePath();
      g.fillStyle = steel; g.fill(); g.strokeStyle = '#2c3a4d'; g.lineWidth = s * 0.03; g.stroke();
      g.strokeStyle = 'rgba(44,58,77,0.6)'; g.beginPath(); g.moveTo(0, -s * 0.84); g.lineTo(0, s * 0.28); g.stroke();   // vaceo
      const gold = g.createLinearGradient(0, s * 0.2, 0, s * 0.5);
      gold.addColorStop(0, '#fff0a0'); gold.addColorStop(1, '#b8860b');
      g.strokeStyle = gold; g.lineCap = 'round'; g.lineWidth = s * 0.13;
      g.beginPath(); g.moveTo(-s * 0.5, s * 0.24); g.quadraticCurveTo(0, s * 0.5, s * 0.5, s * 0.24); g.stroke();   // gavilanes
      g.fillStyle = '#e8b923';
      g.beginPath(); g.arc(-s * 0.52, s * 0.22, s * 0.09, 0, TAU); g.arc(s * 0.52, s * 0.22, s * 0.09, 0, TAU); g.fill();
      g.fillStyle = '#3a2412'; g.fillRect(-s * 0.075, s * 0.4, s * 0.15, s * 0.36);                                  // puño
      g.strokeStyle = '#e8b923'; g.lineWidth = s * 0.03; g.lineCap = 'butt';
      for (let k = 0; k < 4; k++) { const y = s * (0.45 + k * 0.08); g.beginPath(); g.moveTo(-s * 0.075, y); g.lineTo(s * 0.075, y + s * 0.05); g.stroke(); }
      g.fillStyle = gold; g.beginPath(); g.arc(0, s * 0.85, s * 0.12, 0, TAU); g.fill();                             // pomo
    },
    // Campana colonial de bronce (San Francisco): asa, hombros, cuerpo acampanado, labio y badajo
    campana(g, s, detail) {
      const br = g.createLinearGradient(-s * 0.75, 0, s * 0.75, 0);
      br.addColorStop(0, '#4a2e10'); br.addColorStop(0.32, '#e6b56e'); br.addColorStop(0.55, '#a8702c'); br.addColorStop(1, '#3d250b');
      g.strokeStyle = '#6b4416'; g.lineWidth = s * 0.1;
      g.beginPath(); g.arc(0, -s * 0.8, s * 0.13, Math.PI, TAU); g.stroke();                                       // asa
      g.beginPath();
      g.moveTo(-s * 0.2, -s * 0.74);
      g.quadraticCurveTo(-s * 0.48, -s * 0.72, -s * 0.48, -s * 0.15);
      g.lineTo(-s * 0.56, s * 0.32);
      g.quadraticCurveTo(-s * 0.6, s * 0.48, -s * 0.78, s * 0.54);
      g.lineTo(s * 0.78, s * 0.54);
      g.quadraticCurveTo(s * 0.6, s * 0.48, s * 0.56, s * 0.32);
      g.lineTo(s * 0.48, -s * 0.15);
      g.quadraticCurveTo(s * 0.48, -s * 0.72, s * 0.2, -s * 0.74);
      g.closePath(); g.fillStyle = br; g.fill();
      g.strokeStyle = '#2e1b06'; g.lineWidth = s * 0.05; g.stroke();
      g.strokeStyle = 'rgba(46,27,6,0.75)'; g.lineWidth = s * 0.04;                                              // cordones
      g.beginPath(); g.moveTo(-s * 0.47, -s * 0.38); g.lineTo(s * 0.47, -s * 0.38); g.moveTo(-s * 0.6, s * 0.42); g.lineTo(s * 0.6, s * 0.42); g.stroke();
      if (detail) { g.strokeStyle = 'rgba(255,236,190,0.6)'; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(-s * 0.26, -s * 0.55); g.quadraticCurveTo(-s * 0.32, 0, -s * 0.36, s * 0.3); g.stroke(); }
      g.fillStyle = '#5b3a14'; g.beginPath(); g.arc(0, s * 0.68, s * 0.13, 0, TAU); g.fill();                     // badajo
    },
  };
  // Icono de palo cacheado. s = radio lógico; el sprite mide 2.2·s por lado.
  function suitIcon(sym, x, y, s) {
    const key = 'suit|' + sym + '|' + s.toFixed(2), d = s * 2.2;
    blit(sprite(key, d, d, (g) => PAINT[sym](g, s, s >= 9)), x, y, d, d);
  }

  // ------------------------------------------------------------------ figuras (Sota, Caballo, Rey)
  function paintFigure(g, fig, s, color) {
    g.fillStyle = color;
    if (fig === 'rey') {
      g.beginPath(); g.moveTo(-s, s * 0.4); g.lineTo(-s, -s * 0.4); g.lineTo(-s * 0.5, 0); g.lineTo(0, -s * 0.7);
      g.lineTo(s * 0.5, 0); g.lineTo(s, -s * 0.4); g.lineTo(s, s * 0.4); g.closePath(); g.fill();
      g.fillStyle = '#f5c542'; g.beginPath(); g.arc(0, -s * 0.7, s * 0.12, 0, TAU); g.arc(-s, -s * 0.42, s * 0.1, 0, TAU); g.arc(s, -s * 0.42, s * 0.1, 0, TAU); g.fill();
      g.fillRect(-s, s * 0.22, s * 2, s * 0.12);
    } else if (fig === 'caballo') {
      g.beginPath(); g.moveTo(-s * 0.5, s * 0.8); g.lineTo(-s * 0.4, -s * 0.3); g.lineTo(-s * 0.1, -s * 0.8);
      g.lineTo(s * 0.1, -s * 0.5); g.lineTo(s * 0.8, -s * 0.1); g.lineTo(s * 0.6, s * 0.2); g.lineTo(s * 0.1, s * 0.1);
      g.lineTo(s * 0.3, s * 0.8); g.closePath(); g.fill();
      g.fillStyle = '#fbf6ea'; g.beginPath(); g.arc(s * 0.12, -s * 0.28, s * 0.08, 0, TAU); g.fill();
    } else {
      g.beginPath(); g.arc(0, -s * 0.1, s * 0.38, 0, TAU); g.fill();
      g.fillRect(-s * 0.75, -s * 0.5, s * 1.5, s * 0.16); g.fillRect(-s * 0.38, -s * 0.9, s * 0.76, s * 0.42);
      g.fillRect(-s * 0.45, s * 0.3, s * 0.9, s * 0.55);
    }
  }
  function figure(fig, x, y, s, color) {
    const key = 'fig|' + fig + '|' + color + '|' + s.toFixed(2), d = s * 2.2;
    blit(sprite(key, d, d, (g) => paintFigure(g, fig, s, color)), x, y, d, d);
  }

  // =====================================================================
  //  2. REVERSO: telar de rombos con los colores de la bandera de Quito (azul y rojo)
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
  //  3. NAIPE COMPLETO (con inclinación opcional c.rot durante el vuelo)
  // =====================================================================
  function cardAt(c, x, y, w, h) {
    if (!c.faceUp) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(x - w / 2 + 1, y - h / 2 + 2.5, w, h, 5); ctx.fill();
      drawCardBack(x, y, w, h);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(x - w / 2 + 1, y - h / 2 + 2.5, w, h, 5); ctx.fill();       // sombra falsa
    rr(x - w / 2, y - h / 2, w, h, 5); ctx.fillStyle = '#fbf6ea'; ctx.fill();
    ctx.strokeStyle = c.hl ? '#ffd400' : 'rgba(0,0,0,0.35)'; ctx.lineWidth = c.hl ? 3 : 1; ctx.stroke();
    const col = c.suit.color, s = w / 60;
    txt(c.rank.label, x - w / 2 + 9 * s, y - h / 2 + 11 * s, 15 * s, col, 'center', '900', false);
    suitIcon(c.suit.symbol, x - w / 2 + 9 * s, y - h / 2 + 25 * s, 6.5 * s);
    if (c.rank.figure) figure(c.rank.figure, x + 3 * s, y + 4 * s, 15 * s, col);
    else suitIcon(c.suit.symbol, x + 2 * s, y + 5 * s, 17 * s);
    txt(c.rank.label, x + w / 2 - 9 * s, y + h / 2 - 11 * s, 15 * s, col, 'center', '900', false);
  }
  function drawCard(c, w, h) {
    if (c.hidden) return;
    if (c.rot) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); cardAt(c, 0, 0, w, h); ctx.restore(); }
    else cardAt(c, c.x, c.y, w, h);
  }

  // =====================================================================
  //  4. RETRATOS, ESCENARIOS Y PAÑO (sin cambios de diseño respecto a v1.0.0)
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
  function buildFelt(tableTop, tableBottom) {      // paño pre-renderizado una sola vez
    const felt = document.createElement('canvas'); felt.width = Math.ceil(W * RES); felt.height = Math.ceil(H * RES);
    const f = felt.getContext('2d'); f.scale(RES, RES);
    const g = f.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * 0.7);
    g.addColorStop(0, '#1a7a4c'); g.addColorStop(1, '#073a22');
    f.fillStyle = g; f.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { f.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`; f.fillRect(Math.random() * W, Math.random() * H, 1, 1); }
    f.strokeStyle = 'rgba(245,197,66,0.25)'; f.lineWidth = 1.5; f.setLineDash([4, 4]);
    f.strokeRect(14, tableTop - 18, W - 28, tableBottom - tableTop + 36);
    return felt;
  }

  // =====================================================================
  //  5. «PEQUEÑOS DIABLILLOS PROCEDURALES»: pool fijo de partículas
  //     type 0 = chispa (con estela) · type 1 = diablillo (sprite con cuernos)
  // =====================================================================
  const MAX = 80;
  const pool = [];
  for (let i = 0; i < MAX; i++) pool.push({ on: false, type: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, rot: 0, vr: 0, ph: 0, hue: 0 });
  let alive = 0, emitImp = 0, emitSpark = 0, clock = 0;

  function spawn(type, x, y) {
    for (let i = 0; i < MAX; i++) {
      const p = pool[i]; if (p.on) continue;
      p.on = true; p.type = type; p.x = x; p.y = y; p.ph = Math.random() * TAU; p.hue = Math.random();
      if (type === 0) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, v = 40 + Math.random() * 90; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.max = p.life = 0.5 + Math.random() * 0.6; p.size = 1 + Math.random() * 1.4; }
      else { p.vx = (Math.random() - 0.5) * 20; p.vy = -(22 + Math.random() * 26); p.max = p.life = 1.6 + Math.random() * 1.2; p.size = 0.6 + Math.random() * 0.6; p.rot = (Math.random() - 0.5) * 0.4; p.vr = (Math.random() - 0.5) * 1.2; }
      alive++;
      return p;
    }
    return null;                                        // pool lleno: se descarta (nunca crece)
  }
  function paintImp(g) {                                // diablillo: cabeza redonda, cuernos, ojos y sonrisa
    const head = g.createRadialGradient(-3, -3, 1, 0, 0, 9);
    head.addColorStop(0, '#ff6b4a'); head.addColorStop(1, '#a3100a');
    g.fillStyle = '#7a0b06';
    g.beginPath(); g.moveTo(-6, -5); g.quadraticCurveTo(-12, -10, -9, -16); g.quadraticCurveTo(-7, -10, -2, -8); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(6, -5); g.quadraticCurveTo(12, -10, 9, -16); g.quadraticCurveTo(7, -10, 2, -8); g.closePath(); g.fill();
    g.fillStyle = head; g.beginPath(); g.arc(0, 0, 8.5, 0, TAU); g.fill();
    g.strokeStyle = '#7a0b06'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 8); g.quadraticCurveTo(7, 13, 4, 16); g.stroke();   // cola
    g.fillStyle = '#ffe14a'; g.beginPath(); g.ellipse(-3, -1.5, 1.8, 1.2, 0.3, 0, TAU); g.ellipse(3, -1.5, 1.8, 1.2, -0.3, 0, TAU); g.fill();
    g.strokeStyle = '#3a0402'; g.lineWidth = 1; g.beginPath(); g.arc(0, 2, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  const Imps = {
    // Ráfaga en (x, y): n diablillos + m chispas.
    burst(x, y, n = 6, m = 24) {
      for (let i = 0; i < n; i++) { const p = spawn(1, x + (Math.random() - 0.5) * 150, y + (Math.random() - 0.5) * 50); if (p) { p.vx = (Math.random() - 0.5) * 70; p.vy -= 20; } }
      for (let i = 0; i < m; i++) spawn(0, x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 10);
    },
    // Emisión ambiental continua en un rectángulo (tasas por segundo; acumulador fraccional).
    emit(dt, r, impRate, sparkRate) {
      emitImp += impRate * dt; emitSpark += sparkRate * dt;
      while (emitImp >= 1) { emitImp--; spawn(1, r.x + Math.random() * r.w, r.y + r.h); }
      while (emitSpark >= 1) { emitSpark--; spawn(0, r.x + Math.random() * r.w, r.y + r.h - Math.random() * 6); }
    },
    update(dt) {
      if (!alive) return;
      clock += dt;
      for (let i = 0; i < MAX; i++) {
        const p = pool[i]; if (!p.on) continue;
        p.life -= dt;
        if (p.life <= 0) { p.on = false; alive--; continue; }
        if (p.type === 0) { p.vx *= 1 - 1.8 * dt; p.vy = p.vy * (1 - 1.2 * dt) - 30 * dt; }     // arrastre + flotación
        else { p.vx += Math.sin(clock * 3 + p.ph) * 40 * dt; p.vx *= 1 - 1.5 * dt; p.rot += p.vr * dt; } // vaivén
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    },
    draw() {
      if (!alive) return;
      const base = ctx.getTransform();
      // 1) diablillos (sprite único; alfa con entrada y desvanecimiento)
      const imp = sprite('imp', 34, 36, paintImp);
      for (let i = 0; i < MAX; i++) {
        const p = pool[i]; if (!p.on || p.type !== 1) continue;
        const age = p.max - p.life;
        ctx.globalAlpha = Math.min(1, age / 0.25) * Math.pow(p.life / p.max, 0.8) * 0.95;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(clock * 4 + p.ph) * 0.15); ctx.scale(p.size, p.size);
        ctx.drawImage(imp, -17, -18, 34, 36);
        ctx.setTransform(base);
      }
      // 2) chispas (mezcla normal: el modo aditivo sobre el paño verde las volvía color oliva)
      ctx.lineCap = 'round';
      for (let i = 0; i < MAX; i++) {
        const p = pool[i]; if (!p.on || p.type !== 0) continue;
        const a = p.life / p.max;
        ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(clock * 30 + p.ph));                // parpadeo
        ctx.strokeStyle = p.hue < 0.4 ? '#ff2a12' : p.hue < 0.8 ? '#ff8a1f' : '#ffe14a'; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    clear() { for (const p of pool) p.on = false; alive = 0; emitImp = emitSpark = 0; },
    count: () => alive,
  };

  // =====================================================================
  //  API
  // =====================================================================
  CU.Draw = {
    attach(context, w, h) { ctx = context; W = w; H = h; },
    // Llamar en cada resize: invalida los sprites para repintarlos nítidos a la nueva densidad.
    setResolution(k) { if (Math.abs(k - RES) > 0.01) { RES = k; cache.clear(); } },
    cacheSize: () => cache.size,
    txt, rr, wrapLines, button, suitIcon, drawCardBack, drawCard, drawPortrait, drawScene, pennants, buildFelt, Imps,
  };
})(window.CU);
