/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: js/audio.js — Efectos y música de pasacalle sintetizados con Web Audio API (sin archivos)
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.2.0
 */
/*
 * Grafo:  [sfx] ─┐
 *                 ├─► master ─► destination
 *         [bgm] ─┘   (bgm = quena + banda + tuba + bombo/platillo)
 *
 * La música es una composición ORIGINAL al estilo pasacalle quiteño (2/4, La menor armónica con paso
 * al relativo mayor). No reproduce la melodía de «El Chulla Quiteño» (obra protegida de Alfredo Carpio).
 *
 * Planificador: patrón «lookahead» (setInterval cada 40 ms agenda notas 0.25 s por delante en el reloj
 * del AudioContext). El tempo no depende de los FPS ni del hilo de render.
 */
window.CU = window.CU || {};
(function (CU) {
  'use strict';

  let ac = null, master = null, sfxBus = null, bgmBus = null, noiseBuf = null, vibrato = null;
  let muted = false;
  try { muted = localStorage.getItem('cu.muted') === '1'; } catch { /* sin almacenamiento */ }

  const BGM_VOL = 0.34, SFX_VOL = 0.8;

  // ------------------------------------------------------------------ contexto (se crea tras un gesto)
  function audio() {
    if (!ac) {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      ac = new A();
      master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = SFX_VOL; sfxBus.connect(master);
      bgmBus = ac.createGain(); bgmBus.gain.value = 0; bgmBus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // un único LFO de vibrato compartido por todas las notas de quena (ahorra nodos)
      const lfo = ac.createOscillator(); lfo.frequency.value = 5.2;
      vibrato = ac.createGain(); vibrato.gain.value = 6;            // ±6 Hz
      lfo.connect(vibrato); lfo.start();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  // ------------------------------------------------------------------ primitivas
  function tone(bus, type, f0, f1, t, dur, g0, o = {}) {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (o.vib) vibrato.connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(g0, t + (o.attack || 0.005));
    if (o.sustain) g.gain.setValueAtTime(g0 * o.sustain, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; osc.connect(f); node = f; }
    node.connect(g); g.connect(bus);
    osc.start(t); osc.stop(t + dur + 0.05);
    if (o.vib) osc.onended = () => { try { vibrato.disconnect(osc.frequency); } catch { /* ya desconectado */ } };
  }
  function noise(bus, t, dur, g0, type, f0, f1) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }
  const ok = () => !muted && audio();
  const t0 = () => ac.currentTime + 0.01;

  // nota → Hz (A4 = 440). Acepta 'A4', 'C#5', 'G#4'.
  const SEMI = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const hzCache = {};
  function hz(n) {
    if (hzCache[n]) return hzCache[n];
    const m = /^([A-G])(#|b)?(\d)$/.exec(n);
    const semis = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) - 4) * 12;
    return (hzCache[n] = 440 * Math.pow(2, semis / 12));
  }

  // =====================================================================
  //  MÚSICA: pasacalle original «Leyendas de la Ronda»
  // =====================================================================
  // Rejilla de semicorcheas: 8 pasos por compás de 2/4. Token: nota | '-' (sostiene) | '.' (silencio).
  const BPM = 124;                       // tempo de pasacalle bailable
  const STEP = 60 / BPM / 4;             // duración de una semicorchea
  const MELODY = [
    // A — La menor (pregunta / respuesta)
    'A4 - C5 E5 A5 - - -', 'G5 - E5 - C5 D5 E5 -', 'F5 - - - D5 - A4 -', 'C5 - B4 - A4 - - -',
    'B4 - G#4 - B4 D5 E5 -', 'D5 - C5 - B4 - G#4 -', 'A4 - C5 - E5 - C5 -', 'A4 - - - . . E4 -',
    // B — paso al relativo mayor (Do) y regreso por la dominante
    'G4 - C5 - E5 - G5 -', 'E5 - D5 C5 D5 - E5 -', 'D5 - - - F5 - D5 -', 'C5 - E5 - G5 - - -',
    'A5 - - - F5 - C5 -', 'B4 - E5 - G#4 - B4 -', 'A4 - C5 E5 A5 - E5 -', 'A5 - - - . . . .',
  ].map((bar) => bar.split(' '));
  // Acorde por compás: [bajo raíz, bajo quinta, tríada de la banda]
  const CH = {
    Am: ['A2', 'E2', ['A3', 'C4', 'E4']], Dm: ['D3', 'A2', ['D4', 'F4', 'A4']], E7: ['E2', 'B2', ['G#3', 'D4', 'E4']],
    C: ['C3', 'G2', ['C4', 'E4', 'G4']], G7: ['G2', 'D3', ['B3', 'D4', 'F4']], F: ['F2', 'C3', ['F3', 'A3', 'C4']],
  };
  const CHORDS = ['Am', 'Am', 'Dm', 'Am', 'E7', 'E7', 'Am', 'Am', 'C', 'C', 'G7', 'C', 'F', 'E7', 'Am', 'Am'];

  const bgm = { on: false, timer: 0, nextTime: 0, step: 0 };
  const TOTAL_STEPS = MELODY.length * 8;

  function scheduleStep(i, t) {
    const bar = Math.floor(i / 8), s = i % 8, ch = CH[CHORDS[bar]];
    // --- quena: triángulo con vibrato; la duración suma los '-' que siguen
    const tok = MELODY[bar][s];
    if (tok !== '-' && tok !== '.') {
      let len = 1;
      for (let k = i + 1; k < TOTAL_STEPS; k++) { if (MELODY[Math.floor(k / 8)][k % 8] !== '-') break; len++; }
      const dur = len * STEP * 0.95;
      tone(bgmBus, 'triangle', hz(tok), hz(tok), t, dur, 0.30, { attack: 0.02, vib: len >= 3, sustain: 0.8 });
      tone(bgmBus, 'sine', hz(tok) * 2, hz(tok) * 2, t, Math.min(dur, 0.12), 0.04);   // soplo/armónico de la quena
    }
    // --- tuba / bombardino: onda cuadrada filtrada, raíz en 1 y quinta en 2 (bajo de pasacalle)
    if (s === 0 || s === 4) tone(bgmBus, 'square', hz(ch[s === 0 ? 0 : 1]), hz(ch[s === 0 ? 0 : 1]), t, STEP * 2.6, 0.16, { lp: 520, attack: 0.012 });
    // --- banda de pueblo: diente de sierra con paso bajo, acordes a contratiempo («tan-tan»)
    if (s === 2 || s === 6) for (const n of ch[2]) tone(bgmBus, 'sawtooth', hz(n), hz(n), t, STEP * 1.3, 0.045, { lp: 1500, q: 1.2, attack: 0.008 });
    // --- percusión: bombo en el tiempo fuerte, platillo/redoblante a contratiempo
    if (s === 0) { tone(bgmBus, 'sine', 120, 48, t, 0.22, 0.55); noise(bgmBus, t, 0.05, 0.12, 'lowpass', 900); }
    if (s === 3 && bar % 2 === 1) tone(bgmBus, 'sine', 110, 50, t, 0.16, 0.3);       // repique del bombo
    if (s === 2 || s === 6) noise(bgmBus, t, 0.07, 0.10, 'highpass', 6500);
    if (s === 4) noise(bgmBus, t, 0.10, 0.12, 'bandpass', 1800);                      // golpe de caja
  }

  function scheduler() {
    if (!bgm.on || !ac) return;
    const horizon = ac.currentTime + 0.25;
    while (bgm.nextTime < horizon) {
      scheduleStep(bgm.step, bgm.nextTime);
      bgm.nextTime += STEP;
      bgm.step = (bgm.step + 1) % TOTAL_STEPS;
    }
  }

  function playBGM() {
    if (!ok()) return;                     // silenciado o sin Web Audio
    const now = ac.currentTime;
    bgmBus.gain.cancelScheduledValues(now);
    bgmBus.gain.setValueAtTime(bgmBus.gain.value, now);
    bgmBus.gain.linearRampToValueAtTime(BGM_VOL, now + 0.6);   // entrada suave
    if (bgm.on) return;
    bgm.on = true; bgm.step = 0; bgm.nextTime = now + 0.08;
    bgm.timer = setInterval(scheduler, 40);
    scheduler();
  }

  function stopBGM(fade = 0.35) {
    if (!bgm.on) return;
    bgm.on = false; clearInterval(bgm.timer); bgm.timer = 0;
    if (!ac) return;
    const now = ac.currentTime;
    bgmBus.gain.cancelScheduledValues(now);
    bgmBus.gain.setValueAtTime(bgmBus.gain.value, now);
    bgmBus.gain.linearRampToValueAtTime(0, now + fade);        // las notas ya agendadas se apagan con el bus
  }

  // Ahorro de batería: al ocultar la app se suspende el contexto; al volver, se reanuda.
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else if (!muted) { ac.resume(); if (bgm.on) bgm.nextTime = Math.max(bgm.nextTime, ac.currentTime + 0.05); }
  });

  // =====================================================================
  //  API PÚBLICA (CU.Audio; CU.Sfx se mantiene como alias)
  // =====================================================================
  const N = { A3: 220, C4: 261.6, E4: 329.6, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, A5: 880 };
  const T = (type, f0, f1, t, dur, g0, o) => tone(sfxBus, type, f0, f1, t, dur, g0, o);
  const Z = (t, dur, g0, type, f0, f1) => noise(sfxBus, t, dur, g0, type, f0, f1);
  CU.Audio = {
    unlock() { if (!muted) audio(); },
    isMuted: () => muted,
    isPlayingBGM: () => bgm.on,
    toggle() {
      muted = !muted;
      try { localStorage.setItem('cu.muted', muted ? '1' : '0'); } catch { /* */ }
      if (muted) { stopBGM(0.15); } else { audio(); playBGM(); }
      return muted;
    },
    playBGM, stopBGM,
    deal() { if (!ok()) return; Z(t0(), 0.05, 0.25, 'highpass', 3000); },
    select() { if (!ok()) return; T('triangle', 880, 880, t0(), 0.06, 0.12); },
    place() { if (!ok()) return; const t = t0(); Z(t, 0.08, 0.35, 'bandpass', 1200, 500); T('sine', 180, 90, t, 0.08, 0.25); },
    capture() { if (!ok()) return; Z(t0(), 0.25, 0.3, 'bandpass', 600, 3000); },
    caida() { if (!ok()) return; const t = t0(); T('sine', 110, 45, t, 0.3, 0.9); [N.E5, N.A5].forEach((f, i) => T('square', f, f, t + 0.05 + i * 0.12, 0.18, 0.12, { lp: 3000 })); },
    limpia() { if (!ok()) return; const t = t0(); [N.A4, N.C5, N.E5, N.A5].forEach((f, i) => T('triangle', f, f, t + i * 0.07, 0.4, 0.18)); },
    ronda() { if (!ok()) return; const t = t0(); [N.E4, N.A4, N.E5].forEach((f, i) => T('triangle', f, f * 1.002, t + i * 0.1, 0.9, 0.16)); },
    tick() { if (!ok()) return; T('square', 1200, 1200, t0(), 0.03, 0.06); },
    devil() { if (!ok()) return; const t = t0(); T('sawtooth', 70, 40, t, 0.5, 0.25, { lp: 400 }); Z(t, 0.4, 0.2, 'bandpass', 300, 2500); },
    win() { if (!ok()) return; const t = t0(); [N.A3, N.C4, N.E4, N.A4, N.B4, N.C5, N.E5, N.A5].forEach((f, i) => T('square', f, f, t + i * 0.09, 0.22, 0.1, { lp: 2400 })); T('sine', 110, 55, t + 0.72, 0.5, 0.8); },
    lose() { if (!ok()) return; const t = t0(); [N.E4, N.C4, N.B4 / 2, N.A3].forEach((f, i) => T('triangle', f, f, t + i * 0.18, 0.35, 0.16)); },
  };
  CU.Sfx = CU.Audio;
})(window.CU);
