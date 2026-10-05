# CLAUDE.md — cuarenta

> Leer junto con `STATUS.md`. Contexto global en `../CLAUDE.md`. Guía de usuario en `README.md`.

## Qué es
**Cuarenta: El Juicio de las Leyendas** — juego de cartas Cuarenta contra leyendas de Quito (Chulla, Gallo de la Catedral, Padre Almeida, Cantuña y el Diablo), ambientado en las Fiestas de Quito.

## Stack
- Cliente: Canvas 2D + JS vanilla, scripts clásicos con namespace `window.CU` (sin módulos; modo IA funciona con `file://`).
- Servidor online: Node ≥ 18 + Express + Socket.io (`server.js`, `server/match.js`); reglas compartidas con el cliente (`www/js/rules.js`).
- 360×640 vertical; paso fijo 60 Hz; `devicePixelRatio` con tope 3; paño pre-renderizado en un canvas fuera de pantalla.

## Comandos
```bash
npm install && npm start # http://localhost:8080 (juego + online)
npm test                 # match + smoke + audio + online (playwright; CHROMIUM_PATH opcional)
```

## Arquitectura
| Archivo | Responsabilidad |
|---|---|
| `www/js/config.js` | `META`, `CFG` (tiempos), `RULES` (variantes), `RANKS`, `SUITS`, `RIVALS` (estilo, frases, colores, escena), `TEXT` |
| `www/js/rules.js` | `CU.Rules` puras, compartidas con el servidor (UMD: `window` / `module.exports`) |
| `www/js/audio.js` | `CU_AUDIO`: muestras MP3, fondo de piano, respaldo sintetizado |
| `www/js/draw.js` | `CU.Draw`: arte procedural, sprites, partículas |
| `www/js/net.js` | `CU.Net` (Socket.io bajo demanda) y `CU.Lobby` (submenú HTML) |
| `www/js/game.js` | IA, estados, modo online (cola de eventos del servidor), entrada, pantallas, bucle |
| `server.js` / `server/match.js` | Salas Socket.io / árbitro autoritativo (valida turno y carta, emite por perspectiva) |

- **Toda regla nueva va en `www/js/rules.js` con su caso en `tests/smoke.mjs`** (y en `tests/match.mjs` si afecta al online). Las reglas no tocan pantalla ni sonido.
- **Online: el cliente nunca decide.** Solo anima eventos del servidor; nunca enviar al cliente el mazo ni la mano del rival.
- Gancho de pruebas: `CU._debug` (`state`, `game`, `newGame`, `playCard`, `humanPlay`, `aiChoose`, `netQueue`).
- Si `game.js` supera ~1000 líneas, separar `ai.js` y `render.js` (nuevo ADR).

## Convenciones
- Reglas con variantes regionales: siempre configurables en `CU.RULES`, citando la fuente en el README.
- Frases quiteñas en `config.js` (nunca letras de canciones con derechos, p. ej. el pasacalle «El Chulla Quiteño»).
- Cabecera `/*! … © 2026 Byron Sebastián Rosero Díaz … */` en cada archivo fuente.

## Repositorio
- Git propio en esta carpeta (rama `main`, etiqueta `v1.0.0`). Remoto: pendiente.
