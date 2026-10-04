# CLAUDE.md — cuarenta

> Leer junto con `STATUS.md`. Contexto global en `../CLAUDE.md`. Guía de usuario en `README.md`.

## Qué es
**Cuarenta: El Juicio de las Leyendas** — juego de cartas Cuarenta contra leyendas de Quito (Chulla, Gallo de la Catedral, Padre Almeida, Cantuña y el Diablo), ambientado en las Fiestas de Quito.

## Stack
- Canvas 2D + JS vanilla, scripts clásicos con namespace `window.CU` (sin módulos; funciona con `file://`).
- 360×640 vertical; paso fijo 60 Hz; `devicePixelRatio` con tope 3; paño pre-renderizado en un canvas fuera de pantalla.

## Comandos
```bash
npx serve www            # o doble clic en www/index.html
node tests/smoke.mjs     # reglas + partida completa (playwright; CHROMIUM_PATH opcional)
```

## Arquitectura
| Archivo | Responsabilidad |
|---|---|
| `www/js/config.js` | `META`, `CFG` (tiempos), `RULES` (variantes), `RANKS`, `SUITS`, `RIVALS` (estilo, frases, colores, escena), `TEXT` |
| `www/js/game.js` | Secciones: 1) `CU.Rules` puras 2) `CU.Sfx` 3) IA `aiChoose` 4) estados 5) entrada 6) render 7) bucle |

- **Toda regla nueva va en `CU.Rules` con su caso en `tests/smoke.mjs`.** Las reglas no tocan pantalla ni sonido.
- Gancho de pruebas: `CU._debug` (`state`, `game`, `newGame`, `playCard`, `aiChoose`).
- Si `game.js` supera ~1000 líneas, dividir en `rules.js`, `ai.js`, `render.js` (nuevo ADR).

## Convenciones
- Reglas con variantes regionales: siempre configurables en `CU.RULES`, citando la fuente en el README.
- Frases quiteñas en `config.js` (nunca letras de canciones con derechos, p. ej. el pasacalle «El Chulla Quiteño»).
- Cabecera `/*! … © 2026 Byron Sebastián Rosero Díaz … */` en cada archivo fuente.

## Repositorio
- Git propio en esta carpeta (rama `main`, etiqueta `v1.0.0`). Remoto: pendiente.
