/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: js/audio.js — Motor de audio: sampler + secuenciador «Banda de Pueblo Dicembrina» + efectos de jugada
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * Módulo de audio por muestras v1.0.0 · Juego v1.3.1
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados.
 */
/*
 * ARQUITECTURA
 *
 *   preloadAudio() ──fetch──► ArrayBuffer ──decodeAudioData──► AudioBuffer (caché `buffers`)
 *
 *   [voces de efectos] ─► sfxBus ─┐
 *                                 ├─► master ─► destination
 *   [secuenciador BGM] ─► bgmBus ─┘
 *
 * - Cada disparo crea un AudioBufferSourceNode NUEVO (son de un solo uso por especificación) y lo desconecta
 *   en `onended`, junto con su GainNode, para que el recolector los libere (evita fugas en WebView de Android).
 * - Tope de polifonía (MAX_VOICES): si se supera, el disparo se descarta en vez de saturar el hilo de audio.
 * - Reloj: el secuenciador agenda con `audioCtx.currentTime` (reloj del hardware de audio), con la técnica
 *   lookahead: un setInterval de 25 ms solo DECIDE qué agendar en los próximos 120 ms; la precisión la da el
 *   hilo de audio, no el temporizador de JavaScript ni los FPS.
 *
 * RESPALDO SINTETIZADO (no se elimina a propósito):
 * - Con `file://` el navegador bloquea fetch() de archivos locales → no hay muestras. En Capacitor
 *   (https://localhost) sí cargan.
 * - Si falta una muestra, ese efecto se sintetiza; si falta cualquiera de las 3 del bucle, suena el pasacalle
 *   sintetizado de la v1.1 (composición original; NO es «El Chulla Quiteño», obra protegida).
 * - Los efectos sin muestra definida (carta, selección, tic, limpia, ronda, victoria, derrota) siguen sintetizados.
 *
 * API: window.CU_AUDIO (alias de CU.Audio y CU.Sfx)
 *   preloadAudio() → Promise<{ loaded:[], missing:[], mode }>
 *   startBGM() / stopBGM() · playCaida() · playCaidaYLimpia() · playPerro()
 */
window.CU = window.CU || {};
(function (CU) {
  'use strict';

  // =====================================================================
  //  CONFIGURACIÓN
  // =====================================================================
  const CFG = {
    DIR: 'audio/',                 // relativo a index.html → www/audio/
    EXT: 'wav',                    // cambiar a 'ogg' o 'm4a' para reducir peso sin tocar el código
    BPM: 130,
    LOOKAHEAD_MS: 25,              // cada cuánto despierta el planificador
    HORIZON_S: 0.12,               // cuánto agenda por delante
    MAX_VOICES: 24,                // polifonía máxima simultánea
    BGM_VOL: 0.5, SFX_VOL: 0.9,
    VIENTOS_MAX_S: null,           // recorte opcional del fragmento de vientos (s); null = suena completo
  };
  // nombre lógico → archivo (sin extensión)
  const SAMPLES = {
    bombo: 'bombo', platillo: 'platillo', vientos: 'vientos_pasacalle',
    latigo: 'latigo', risa: 'risa_diablo', perro: 'perro_ladrido',
  };
  const LOOP_SAMPLES = ['bombo', 'platillo', 'vientos'];

  // Patrón por tiempo del compás (4 tiempos). Editable: [muestra, ganancia].
  // Tal como se especificó es un 4/4 parejo (no síncopado). Para sincopar habría que pasar a una rejilla de
  // corcheas y añadir golpes a contratiempo; se deja como datos para ajustarlo sin tocar el planificador.
  const PATTERN = [
    [['bombo', 1.0]],                        // 1: golpe seco
    [['bombo', 0.75], ['platillo', 0.7]],     // 2: bombo + platillo
    [['bombo', 0.85]],                        // 3: bombo
    [['vientos', 0.9]],                       // 4: frase corta de vientos
  ];

  // =====================================================================
  //  ESTADO
  // =====================================================================
  let ac = null, master = null, sfxBus = null, bgmBus = null, noiseBuf = null, vibrato = null;
  const buffers = Object.create(null);          // nombre lógico → AudioBuffer
  const status = { loaded: [], missing: [], mode: 'sintetizado', preloaded: false };
  let voices = 0, muted = false;
  try { muted = localStorage.getItem('cu.muted') === '1'; } catch { /* sin almacenamiento */ }

  // ------------------------------------------------------------------ contexto
  // Se puede crear antes del primer toque (queda «suspended», sirve para decodificar). Solo se REANUDA
  // dentro de un gesto del usuario (política de autoplay de Chrome, Android WebView y Capacitor).
  function ensureContext() {
    if (ac) return ac;
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ac = new A();
    master = ac.createGain(); master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = CFG.SFX_VOL; sfxBus.connect(master);
    bgmBus = ac.createGain(); bgmBus.gain.value = 0; bgmBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const lfo = ac.createOscillator(); lfo.frequency.value = 5.2;                 // vibrato de la quena (respaldo)
    vibrato = ac.createGain(); vibrato.gain.value = 6; lfo.connect(vibrato); lfo.start();
    return ac;
  }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }
  const ready = () => !muted && ensureContext();
  const now = () => ac.currentTime + 0.005;

  // =====================================================================
  //  1. CARGA DE MUESTRAS
  // =====================================================================
  // decodeAudioData con promesa y con callback (Safari/WebView antiguos solo aceptan callback).
  function decode(arr) {
    return new Promise((res, rej) => { const p = ac.decodeAudioData(arr, res, rej); if (p && p.then) p.then(res, rej); });
  }
  async function loadOne(name) {
    const r = await fetch(CFG.DIR + SAMPLES[name] + '.' + CFG.EXT);
    if (!r.ok) throw new Error(r.status + ' ' + r.url);
    buffers[name] = await decode(await r.arrayBuffer());
    return name;
  }
  // Idempotente: llamadas repetidas o concurrentes comparten la MISMA promesa (no duplican fetch ni listas).
  let preloading = null;
  function preloadAudio() { return preloading || (preloading = doPreload()); }
  async function doPreload() {
    status.loaded = []; status.missing = [];
    if (!ensureContext()) { status.mode = 'sin Web Audio'; status.preloaded = true; return status; }
    if (location.protocol === 'file:') {
      // fetch de file:// está bloqueado: ni se intenta (evita errores en consola). Respaldo sintetizado.
      status.missing = Object.keys(SAMPLES); status.mode = 'sintetizado (file://)'; status.preloaded = true; return status;
    }
    const names = Object.keys(SAMPLES);
    const res = await Promise.allSettled(names.map(loadOne));                     // en paralelo; una falla no frena al resto
    res.forEach((r, i) => (r.status === 'fulfilled' ? status.loaded : status.missing).push(names[i]));
    status.mode = LOOP_SAMPLES.every((n) => buffers[n]) ? 'muestras' : 'sintetizado';
    status.preloaded = true;
    // Si la música ya sonaba con el respaldo y las muestras llegaron después, se cambia al sampler en caliente.
    if (seq.on && status.mode === 'muestras' && seq.mode !== 'muestras') { seq.mode = 'muestras'; seq.beat = 0; }
    return status;
  }

  // =====================================================================
  //  2. VOCES (un AudioBufferSourceNode por disparo, liberado en onended)
  // =====================================================================
  function playSample(name, t, opt = {}) {
    const buf = buffers[name];
    if (!buf || !ac) return false;
    if (voices >= CFG.MAX_VOICES) return true;                                    // saturado: se descarta en silencio
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf;
    if (opt.rate) src.playbackRate.value = opt.rate;
    g.gain.value = opt.gain == null ? 1 : opt.gain;
    src.connect(g); g.connect(opt.bus || sfxBus);
    src.start(t);
    if (opt.maxDur) {                                                             // recorte con micro-fundido (sin clic)
      g.gain.setValueAtTime(g.gain.value, t + opt.maxDur - 0.02);
      g.gain.linearRampToValueAtTime(0, t + opt.maxDur);
      src.stop(t + opt.maxDur + 0.01);
    }
    voices++;
    src.onended = () => { voices--; src.disconnect(); g.disconnect(); src.onended = null; };
    return true;
  }

  // ------------------------------------------------------------------ síntesis de respaldo
  function tone(bus, type, f0, f1, t, dur, g0, o = {}) {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (o.vib) vibrato.connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(g0, t + (o.attack || 0.005));
    if (o.sustain) g.gain.setValueAtTime(g0 * o.sustain, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc, f = null;
    if (o.lp) { f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; osc.connect(f); node = f; }
    node.connect(g); g.connect(bus); osc.start(t); osc.stop(t + dur + 0.05);
    osc.onended = () => { if (o.vib) { try { vibrato.disconnect(osc.frequency); } catch { /* */ } } osc.disconnect(); if (f) f.disconnect(); g.disconnect(); };
  }
  function noise(bus, t, dur, g0, type, f0, f1) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
  }
  const SYN = {                                             // equivalentes sintetizados de cada muestra
    bombo: (t, v, bus) => { tone(bus, 'sine', 120, 45, t, 0.25, 0.9 * v); noise(bus, t, 0.04, 0.2 * v, 'lowpass', 900); },
    platillo: (t, v, bus) => noise(bus, t, 0.22, 0.25 * v, 'highpass', 6000),
    vientos: (t, v, bus) => { for (const f of [220, 277.2, 329.6]) tone(bus, 'sawtooth', f, f, t, 0.3, 0.07 * v, { lp: 1600, attack: 0.01 }); },
    latigo: (t, v, bus) => { noise(bus, t, 0.09, 0.9 * v, 'highpass', 2500); tone(bus, 'sine', 110, 45, t, 0.25, 0.8 * v); },
    risa: (t, v, bus) => { for (let k = 0; k < 4; k++) tone(bus, 'sawtooth', 190 - k * 12, 150 - k * 12, t + k * 0.13, 0.11, 0.18 * v, { lp: 900 }); },
    perro: (t, v, bus) => { for (let k = 0; k < 2; k++) { tone(bus, 'square', 620, 330, t + k * 0.16, 0.09, 0.14 * v, { lp: 2200 }); noise(bus, t + k * 0.16, 0.06, 0.12 * v, 'bandpass', 1200); } },
  };
  // Dispara la muestra; si no está cargada, su equivalente sintetizado.
  function hit(name, t, gain = 1, bus = sfxBus, opt = {}) {
    if (!playSample(name, t, { gain, bus, ...opt })) SYN[name](t, gain, bus);
  }

  // =====================================================================
  //  3. SECUENCIADOR «BANDA DE PUEBLO DICEMBRINA» (130 BPM, muestras)
  // =====================================================================
  const seq = { on: false, timer: 0, next: 0, beat: 0, mode: '' };
  const BEAT = () => 60 / CFG.BPM;

  function scheduleBeatSamples(beat, t) {
    for (const [name, g] of PATTERN[beat % PATTERN.length]) {
      hit(name, t, g, bgmBus, name === 'vientos' && CFG.VIENTOS_MAX_S ? { maxDur: CFG.VIENTOS_MAX_S } : {});
    }
  }

  // ------------------------------------------------------------------ respaldo: pasacalle sintetizado (v1.1)
  const SEMI = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }, hzCache = {};
  function hz(n) {
    if (hzCache[n]) return hzCache[n];
    const m = /^([A-G])(#|b)?(\d)$/.exec(n);
    return (hzCache[n] = 440 * Math.pow(2, (SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] - 4) * 12) / 12));
  }
  const MELODY = [
    'A4 - C5 E5 A5 - - -', 'G5 - E5 - C5 D5 E5 -', 'F5 - - - D5 - A4 -', 'C5 - B4 - A4 - - -',
    'B4 - G#4 - B4 D5 E5 -', 'D5 - C5 - B4 - G#4 -', 'A4 - C5 - E5 - C5 -', 'A4 - - - . . E4 -',
    'G4 - C5 - E5 - G5 -', 'E5 - D5 C5 D5 - E5 -', 'D5 - - - F5 - D5 -', 'C5 - E5 - G5 - - -',
    'A5 - - - F5 - C5 -', 'B4 - E5 - G#4 - B4 -', 'A4 - C5 E5 A5 - E5 -', 'A5 - - - . . . .',
  ].map((b) => b.split(' '));
  const CH = {
    Am: ['A2', 'E2', ['A3', 'C4', 'E4']], Dm: ['D3', 'A2', ['D4', 'F4', 'A4']], E7: ['E2', 'B2', ['G#3', 'D4', 'E4']],
    C: ['C3', 'G2', ['C4', 'E4', 'G4']], G7: ['G2', 'D3', ['B3', 'D4', 'F4']], F: ['F2', 'C3', ['F3', 'A3', 'C4']],
  };
  const CHORDS = ['Am', 'Am', 'Dm', 'Am', 'E7', 'E7', 'Am', 'Am', 'C', 'C', 'G7', 'C', 'F', 'E7', 'Am', 'Am'];
  const TOTAL16 = MELODY.length * 8;
  function scheduleSynthStep(i, t, step) {                                       // i = semicorchea del ciclo
    const bar = Math.floor(i / 8), s = i % 8, ch = CH[CHORDS[bar]], tok = MELODY[bar][s];
    if (tok !== '-' && tok !== '.') {
      let len = 1; for (let k = i + 1; k < TOTAL16 && MELODY[Math.floor(k / 8)][k % 8] === '-'; k++) len++;
      tone(bgmBus, 'triangle', hz(tok), hz(tok), t, len * step * 0.95, 0.3, { attack: 0.02, vib: len >= 3, sustain: 0.8 });
    }
    if (s === 0 || s === 4) tone(bgmBus, 'square', hz(ch[s ? 1 : 0]), hz(ch[s ? 1 : 0]), t, step * 2.6, 0.16, { lp: 520, attack: 0.012 });
    if (s === 2 || s === 6) for (const n of ch[2]) tone(bgmBus, 'sawtooth', hz(n), hz(n), t, step * 1.3, 0.045, { lp: 1500, q: 1.2 });
    if (s === 0) SYN.bombo(t, 0.6, bgmBus);
    if (s === 2 || s === 6) SYN.platillo(t, 0.4, bgmBus);
  }

  function scheduler() {
    if (!seq.on || !ac) return;
    const horizon = ac.currentTime + CFG.HORIZON_S;
    if (seq.mode === 'muestras') {
      while (seq.next < horizon) { scheduleBeatSamples(seq.beat, seq.next); seq.next += BEAT(); seq.beat = (seq.beat + 1) % PATTERN.length; }
    } else {
      const step = BEAT() / 4;                                                     // semicorchea al mismo tempo
      while (seq.next < horizon) { scheduleSynthStep(seq.beat, seq.next, step); seq.next += step; seq.beat = (seq.beat + 1) % TOTAL16; }
    }
  }

  // Solo debe llamarse desde un gesto del usuario (toque en el menú): reanuda el contexto y arranca el bucle.
  function startBGM() {
    if (!ready()) return;
    resume();
    const t = ac.currentTime;
    bgmBus.gain.cancelScheduledValues(t); bgmBus.gain.setValueAtTime(bgmBus.gain.value, t);
    bgmBus.gain.linearRampToValueAtTime(CFG.BGM_VOL, t + 0.5);
    if (seq.on) return;
    seq.mode = LOOP_SAMPLES.every((n) => buffers[n]) ? 'muestras' : 'sintetizado';
    seq.on = true; seq.beat = 0; seq.next = t + 0.06;
    seq.timer = setInterval(scheduler, CFG.LOOKAHEAD_MS);
    scheduler();
  }
  function stopBGM(fade = 0.35) {
    if (!seq.on) return;
    seq.on = false; clearInterval(seq.timer); seq.timer = 0;
    if (!ac) return;
    const t = ac.currentTime;
    bgmBus.gain.cancelScheduledValues(t); bgmBus.gain.setValueAtTime(bgmBus.gain.value, t);
    bgmBus.gain.linearRampToValueAtTime(0, t + fade);                             // lo ya agendado se apaga con el bus
  }

  // App en segundo plano: suspender (batería y evita ráfagas de notas atrasadas al volver).
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else if (!muted && seq.on) { ac.resume().then(() => { seq.next = Math.max(seq.next, ac.currentTime + 0.05); }); }
  });

  // =====================================================================
  //  4. EFECTOS DE JUGADA (disparadores para game.js)
  // =====================================================================
  function playCaida() { if (!ready()) return; resume(); hit('latigo', now(), 1); }
  function playCaidaYLimpia() {
    if (!ready()) return; resume();
    const t = now();
    hit('latigo', t, 1);
    hit('risa', t + 0.18, 0.9);                                                   // carcajada justo tras el latigazo
  }
  function playPerro() { if (!ready()) return; resume(); hit('perro', now(), 1); }

  // =====================================================================
  //  API PÚBLICA
  // =====================================================================
  const N = { A3: 220, C4: 261.6, E4: 329.6, A4: 440, B4: 493.9, C5: 523.3, E5: 659.3, A5: 880 };
  const T = (type, f0, f1, t, dur, g0, o) => tone(sfxBus, type, f0, f1, t, dur, g0, o);
  const Z = (t, dur, g0, type, f0, f1) => noise(sfxBus, t, dur, g0, type, f0, f1);
  const syn = (fn) => function () { if (!ready()) return; resume(); fn(now()); };

  CU.Audio = {
    CFG, PATTERN,
    preloadAudio,
    status: () => ({ ...status, voices, bgm: seq.on ? seq.mode : 'apagado' }),
    startBGM, stopBGM,
    isPlayingBGM: () => seq.on,
    playCaida, playCaidaYLimpia, playPerro,
    unlock() { if (!muted && ensureContext()) resume(); },
    isMuted: () => muted,
    toggle() {
      muted = !muted;
      try { localStorage.setItem('cu.muted', muted ? '1' : '0'); } catch { /* */ }
      if (muted) stopBGM(0.15); else startBGM();
      return muted;
    },
    // efectos sin muestra propia (sintetizados)
    deal: syn((t) => Z(t, 0.05, 0.25, 'highpass', 3000)),
    select: syn((t) => T('triangle', 880, 880, t, 0.06, 0.12)),
    place: syn((t) => { Z(t, 0.08, 0.35, 'bandpass', 1200, 500); T('sine', 180, 90, t, 0.08, 0.25); }),
    capture: syn((t) => Z(t, 0.25, 0.3, 'bandpass', 600, 3000)),
    limpia: syn((t) => [N.A4, N.C5, N.E5, N.A5].forEach((f, i) => T('triangle', f, f, t + i * 0.07, 0.4, 0.18))),
    ronda: syn((t) => [N.E4, N.A4, N.E5].forEach((f, i) => T('triangle', f, f * 1.002, t + i * 0.1, 0.9, 0.16))),
    tick: syn((t) => T('square', 1200, 1200, t, 0.03, 0.06)),
    devil: syn((t) => hit('risa', t, 0.8)),                                       // risa de Cantuña (muestra si existe)
    win: syn((t) => { [N.A3, N.C4, N.E4, N.A4, N.B4, N.C5, N.E5, N.A5].forEach((f, i) => T('square', f, f, t + i * 0.09, 0.22, 0.1, { lp: 2400 })); T('sine', 110, 55, t + 0.72, 0.5, 0.8); }),
    lose: syn((t) => [N.E4, N.C4, N.B4 / 2, N.A3].forEach((f, i) => T('triangle', f, f, t + i * 0.18, 0.35, 0.16))),
  };
  // Compatibilidad: nombres anteriores
  CU.Audio.playBGM = startBGM;
  CU.Audio.caida = playCaida;
  CU.Sfx = CU.Audio;
  window.CU_AUDIO = CU.Audio;
})(window.CU);
