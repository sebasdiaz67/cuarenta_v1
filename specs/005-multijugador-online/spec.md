# Spec 005 — Multijugador online (servidor autoritativo)

**Estado:** Implementada (local) · **Fecha:** 2026-10-05 · **Proyecto:** cuarenta · **Versión:** 1.6.0

## Decisiones del usuario
- **Servidor autoritativo** (no relay): el servidor baraja, valida y aplica las reglas; cada cliente recibe solo su mano.
- **Hosting:** aún no definido → se prueba en local (`npm start`, puerto 8080) y la URL queda en `CU.NET.SERVER_URL`.

## Arquitectura
```
www/js/config.js ─┐
www/js/rules.js ──┼─► navegador (IA local)            CU.Rules
                  └─► server/match.js (árbitro online) require(...)   ← MISMAS reglas
server.js  Express (sirve www/) + Socket.io
   createRoom → { code }      joinRoom({code}) → gameStart     playerMove({cardId}) → valida y emite
   game {deal|ronda|turn|played|carton|gameOver} por jugador · rivalMoved · rivalLeft
www/js/net.js  carga Socket.io bajo demanda desde el servidor + submenú HTML (código de mesa)
www/js/game.js modo online: cola de eventos; anima lo que dicta el servidor; estados TURNO_RIVAL_RED / ESPERA_RED
```

## Requisitos
- Menú principal: «🤖 Jugar contra la IA» y «🤝 Jugar con un Amigo (Online)»; submenú en paño verde con Código de Mesa, Crear Mesa y Unirse a Mesa.
- Servidor: código de 4 dígitos con `crypto`, barajado con `crypto`, 5 cartas a cada uno, validación de turno y de carta, perspectivas «you/rival», limpieza de mesas al desconectar, al salir, al terminar (30 s) y a los 10 min sin rival; tope de 5 000 mesas; 10 intentos de unirse por minuto por conexión; CORS restringido (`ALLOWED_ORIGINS`).
- Cliente: nunca recibe el mazo ni la mano del rival (solo reversos); si el amigo sale → «Partida interrumpida» (sin ganador).

## Desvíos respecto al pedido (justificados)
> ⚠️ `<script src="/socket.io/socket.io.js">` estático NO se incluye: con `file://` y en Capacitor esa ruta no existe y rompería la carga. `net.js` lo carga desde el servidor al entrar al modo online.
> ⚠️ `playerMove` no se «retransmite» tal cual: el servidor lo valida y emite el resultado a ambos (`game`/`played`); además emite `rivalMoved` al rival por compatibilidad.
> ⚠️ El reparto inicial llega en el evento `game` (`deal`) inmediatamente después de `gameStart`, no dentro de `gameStart`.
> ⚠️ Notch: `max(env(safe-area-inset-top), 25px)` solo en pantallas táctiles (en escritorio no se pierden 25 px).
> ⚠️ Sin reconexión: si un jugador pierde la red, la partida se interrumpe.

## Criterios de aceptación
- [x] `tests/match.mjs` 15/15 — 300 partidas del árbitro (~47 000 jugadas) + protocolo Socket.io.
- [x] `tests/online.mjs` 15/15 — dos navegadores reales: lobby, partida completa, marcadores espejo, 40 cartas, sin fugas, abandono, limpieza de memoria.
- [x] `tests/smoke.mjs` 66/66 · `tests/audio.mjs` 21/21.
- [ ] Desplegar el servidor (HTTPS) y configurar `CU.NET.SERVER_URL` para el APK.
- [ ] Prueba con dos celulares reales en redes distintas.
