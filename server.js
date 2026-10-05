/*!
 * Cuarenta: El Juicio de las Leyendas
 * Archivo: server.js — Servidor online (Express + Socket.io) con árbitro autoritativo
 * Autor: Byron Sebastián Rosero Díaz — Ingeniero de Software
 * © 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. v1.6.0
 */
/*
 * Uso:   npm install && npm start            → http://localhost:8080 (sirve también el juego de www/)
 * Env:   PORT (8080) · ALLOWED_ORIGINS (lista separada por comas; por defecto localhost y Capacitor)
 *
 * Eventos cliente → servidor (todos con acuse `ack`):
 *   createRoom()            → { ok, code }                  crea una mesa con código de 4 dígitos
 *   joinRoom({ code })      → { ok, code } | { ok:false, error }
 *   playerMove({ cardId })  → { ok } | { ok:false, error }   el servidor valida y aplica las reglas
 *   leaveRoom()
 * Eventos servidor → cliente:
 *   gameStart { code }      la mesa está llena; le siguen los eventos de la partida
 *   game      { type, … }   eventos del árbitro desde la perspectiva de cada jugador (ver server/match.js)
 *   rivalMoved { … }        copia del evento «played» del rival (atajo para la UI)
 *   rivalLeft               el rival se desconectó o salió; la mesa se cierra
 */
'use strict';
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const express = require('express');
const { Server } = require('socket.io');
const { Match } = require('./server/match.js');

const PORT = Number(process.env.PORT) || 8080;
const ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'http://localhost:8080,http://127.0.0.1:8080,https://localhost,http://localhost,capacitor://localhost')
  .split(',').map((s) => s.trim()).filter(Boolean);
const LIMITS = {
  MAX_ROOMS: 5000,                 // tope de mesas en memoria
  WAITING_TTL_MS: 10 * 60 * 1000,  // una mesa sin rival se borra a los 10 min
  JOIN_ATTEMPTS_PER_MIN: 10,       // freno a quien intente adivinar códigos
};

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'www'), { maxAge: '1h' }));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGINS }, maxHttpBufferSize: 4096, pingTimeout: 20000 });

/** @type {Map<string, { code:string, players:string[], match:Match|null, createdAt:number }>} */
const rooms = new Map();

function newCode() {
  for (let i = 0; i < 50; i++) {
    const code = String(crypto.randomInt(0, 10000)).padStart(4, '0');
    if (!rooms.has(code)) return code;
  }
  return null;                                               // espacio de códigos saturado
}

function closeRoom(code, leaver) {
  const room = rooms.get(code);
  if (!room) return;
  rooms.delete(code);
  for (const sid of room.players) {
    const s = io.sockets.sockets.get(sid);
    if (!s) continue;
    s.leave(code); s.data.room = null;
    if (sid !== leaver) s.emit('rivalLeft');
  }
}

function startMatch(room) {
  room.match = new Match({
    onEvent: (p, e) => {
      const sid = room.players[p];
      io.to(sid).emit('game', e);
      if (e.type === 'played' && e.by === 'rival') io.to(sid).emit('rivalMoved', e);
    },
  });
  for (const sid of room.players) io.to(sid).emit('gameStart', { code: room.code });
  room.match.start();
}

io.on('connection', (socket) => {
  socket.data.room = null;
  socket.data.joins = [];
  const reply = (ack, payload) => { if (typeof ack === 'function') ack(payload); };

  socket.on('createRoom', (ack) => {
    if (socket.data.room) closeRoom(socket.data.room, socket.id);
    if (rooms.size >= LIMITS.MAX_ROOMS) return reply(ack, { ok: false, error: 'Servidor lleno, intenta más tarde' });
    const code = newCode();
    if (!code) return reply(ack, { ok: false, error: 'No hay códigos libres' });
    rooms.set(code, { code, players: [socket.id], match: null, createdAt: Date.now() });
    socket.join(code); socket.data.room = code;
    reply(ack, { ok: true, code });
  });

  socket.on('joinRoom', (data, ack) => {
    const now = Date.now();
    socket.data.joins = socket.data.joins.filter((t) => now - t < 60000);
    if (socket.data.joins.length >= LIMITS.JOIN_ATTEMPTS_PER_MIN) return reply(ack, { ok: false, error: 'Demasiados intentos, espera un minuto' });
    socket.data.joins.push(now);
    const code = data && typeof data.code === 'string' ? data.code.trim() : '';
    if (!/^\d{4}$/.test(code)) return reply(ack, { ok: false, error: 'El código son 4 dígitos' });
    const room = rooms.get(code);
    if (!room) return reply(ack, { ok: false, error: 'No existe esa mesa' });
    if (room.players.includes(socket.id)) return reply(ack, { ok: false, error: 'Ya estás en esa mesa' });
    if (room.players.length >= 2) return reply(ack, { ok: false, error: 'La mesa está llena' });
    if (socket.data.room) closeRoom(socket.data.room, socket.id);
    room.players.push(socket.id);
    socket.join(code); socket.data.room = code;
    reply(ack, { ok: true, code });
    startMatch(room);                                        // 2 jugadores: el servidor baraja y reparte
  });

  socket.on('playerMove', (data, ack) => {
    const room = rooms.get(socket.data.room);
    if (!room || !room.match) return reply(ack, { ok: false, error: 'No estás en una partida' });
    const p = room.players.indexOf(socket.id);
    const cardId = data && typeof data.cardId === 'string' ? data.cardId : '';
    const res = room.match.play(p, cardId);
    reply(ack, res);
    if (room.match.over) setTimeout(() => rooms.get(room.code) === room && closeRoom(room.code, null), 30000);   // libera memoria
  });

  socket.on('leaveRoom', () => { if (socket.data.room) closeRoom(socket.data.room, socket.id); });
  socket.on('disconnect', () => { if (socket.data.room) closeRoom(socket.data.room, socket.id); });
});

// Limpieza periódica de mesas sin rival.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (!room.match && now - room.createdAt > LIMITS.WAITING_TTL_MS) closeRoom(code, null);
}, 60 * 1000).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log(`Cuarenta online en http://localhost:${PORT} · orígenes: ${ORIGINS.join(', ')}`));
}
module.exports = { app, server, io, rooms, LIMITS };
