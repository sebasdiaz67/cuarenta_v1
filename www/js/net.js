/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: js/net.js — Conexión al servidor online (Socket.io bajo demanda) y submenú «Jugar con un Amigo»
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.8.0
 */
/*
 * - El cliente de Socket.io se descarga del propio servidor SOLO al entrar al modo online, desde
 *   CU.NET.SERVER_URL (o el mismo origen si el juego se sirve por http/https). Así el juego sigue sin
 *   dependencias y funciona con doble clic (file://) en modo IA.
 * - El servidor es el árbitro: este módulo solo envía la carta elegida y entrega los eventos a game.js.
 *
 * API (CU.Net):  available() · createRoom() · joinRoom(code) · move(cardId) · leave()
 *                onEvent(e) y onStart(e) los asigna game.js
 * API (CU.Lobby): open() · close() · onBack (lo asigna game.js)
 */
(function (CU) {
  'use strict';
  const NET = CU.NET;
  let socket = null, loading = null;

  function baseUrl() {
    if (NET.SERVER_URL) return NET.SERVER_URL.replace(/\/+$/, '');
    if (/^https?:$/.test(location.protocol)) return location.origin;
    return null;                                                    // file:// sin servidor configurado
  }

  function loadClient(base) {
    if (window.io) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = base + '/socket.io/socket.io.js';
      s.onload = resolve;
      s.onerror = () => { loading = null; s.remove(); reject(new Error('No se pudo contactar al servidor')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  async function connect() {
    const base = baseUrl();
    if (!base) throw new Error('El modo online necesita el servidor: ábrelo con «npm start» o configura CU.NET.SERVER_URL.');
    await loadClient(base);
    if (socket && socket.connected) return socket;
    socket = window.io(base, { transports: ['websocket', 'polling'], timeout: NET.CONNECT_TIMEOUT_MS, reconnection: false });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('El servidor no responde')), NET.CONNECT_TIMEOUT_MS);
      socket.once('connect', () => { clearTimeout(t); resolve(); });
      socket.once('connect_error', () => { clearTimeout(t); reject(new Error('El servidor no responde')); });
    });
    socket.on('game', (e) => Net.onEvent && Net.onEvent(e));
    socket.on('gameStart', (e) => Net.onStart && Net.onStart(e));
    socket.on('rivalLeft', () => Net.onEvent && Net.onEvent({ type: 'rivalLeft' }));
    socket.on('disconnect', () => Net.onEvent && Net.onEvent({ type: 'disconnected' }));
    return socket;
  }

  // Petición con acuse y tiempo máximo: nunca deja la interfaz colgada.
  function ask(ev, data) {
    return new Promise((resolve) => {
      if (!socket || !socket.connected) return resolve({ ok: false, error: 'Sin conexión con el servidor' });
      const t = setTimeout(() => resolve({ ok: false, error: 'El servidor no respondió' }), NET.CONNECT_TIMEOUT_MS);
      const cb = (r) => { clearTimeout(t); resolve(r || { ok: false, error: 'Respuesta vacía' }); };
      if (data === undefined) socket.emit(ev, cb); else socket.emit(ev, data, cb);
    });
  }

  const Net = {
    onEvent: null, onStart: null,
    available: () => !!baseUrl(),
    async createRoom() { await connect(); return ask('createRoom'); },
    async joinRoom(code) { await connect(); return ask('joinRoom', { code }); },
    move(cardId) { return ask('playerMove', { cardId }); },
    leave() {
      if (!socket) return;
      socket.off();                                                 // sin «disconnected» al salir a propósito
      if (socket.connected) socket.emit('leaveRoom');
      socket.disconnect(); socket = null;
    },
  };
  CU.Net = Net;

  // =====================================================================
  //  Submenú «Jugar con un Amigo (Online)» (DOM sobre el canvas)
  // =====================================================================
  const $ = (id) => document.getElementById(id);
  const ui = { root: $('lobby'), create: $('lb-create'), join: $('lb-join'), code: $('lb-code'), status: $('lb-status'), back: $('lb-back') };
  let busy = false;

  function setStatus(html, error = false) { ui.status.innerHTML = html; ui.status.classList.toggle('error', error); }
  function setBusy(b) { busy = b; ui.create.disabled = b; ui.join.disabled = b; ui.code.disabled = b; }
  const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const Lobby = {
    onBack: null,
    open() {
      ui.root.hidden = false; setBusy(false); ui.code.value = '';
      if (!Net.available()) {
        setStatus('El modo online necesita el servidor.<br>Ábrelo con <b>npm start</b> o configura la URL del servidor.', true);
        ui.create.disabled = ui.join.disabled = ui.code.disabled = true;
      } else setStatus('');
    },
    close() { ui.root.hidden = true; },
    isOpen: () => !ui.root.hidden,
  };
  CU.Lobby = Lobby;

  ui.code.addEventListener('input', () => { ui.code.value = ui.code.value.replace(/\D/g, '').slice(0, 4); });
  ui.code.addEventListener('keydown', (e) => { if (e.key === 'Enter') ui.join.click(); });

  ui.create.addEventListener('click', async () => {
    if (busy) return;
    CU.Audio.unlock();                                              // gesto del usuario: habilita el audio
    setBusy(true); setStatus('Creando mesa…');
    try {
      const r = await Net.createRoom();
      if (!r.ok) throw new Error(r.error);
      setStatus(`Tu mesa es<span class="code">${escape(r.code)}</span>Pásale este código a tu amigo. Esperando…`);
      ui.join.disabled = true; ui.code.disabled = true;           // sigue «ocupado» hasta que entre el rival
    } catch (err) { setBusy(false); setStatus(escape(err.message), true); }
  });

  ui.join.addEventListener('click', async () => {
    if (busy) return;
    const code = ui.code.value.trim();
    if (!/^\d{4}$/.test(code)) { setStatus('El código son 4 dígitos', true); ui.code.focus(); return; }
    CU.Audio.unlock();
    setBusy(true); setStatus('Entrando a la mesa ' + escape(code) + '…');
    try {
      const r = await Net.joinRoom(code);
      if (!r.ok) throw new Error(r.error);
      setStatus('¡Adentro! Repartiendo…');
    } catch (err) { setBusy(false); setStatus(escape(err.message), true); }
  });

  ui.back.addEventListener('click', () => { Net.leave(); Lobby.close(); if (Lobby.onBack) Lobby.onBack(); });
})(window.CU);
