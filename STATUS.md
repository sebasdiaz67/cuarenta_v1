# STATUS — cuarenta

**Última actualización:** 2026-10-04
**Estado general:** v1.4.0 — Arte cartoon, perros y tantos, diablillos y audio con 5 de 6 muestras MP3 reales (los vientos se sintetizan). Sin empaquetado.

## Features
| Spec | Estado | Notas |
|---|---|---|
| [001-motor-y-reglas](specs/001-motor-y-reglas/spec.md) | Implementada | Smoke 31/31 |
| [002-arte-musica-dinamismo](specs/002-arte-musica-dinamismo/spec.md) | Implementada | Smoke 37/37 · render p95 2.5 ms (CPU ×4) |
| [003-arte-cartoon](specs/003-arte-cartoon/spec.md) | Implementada | Smoke 39/39 · perros y tantos en el marcador |
| [004-audio-muestras](specs/004-audio-muestras/spec.md) | Implementada · falta 1 muestra | audio 15/15 (MP3 reales) · smoke 53/53 |

## Próximos pasos (priorizados)
1. Probar en celular real: legibilidad de cartas y dificultad de cada leyenda.
2. Spec 005 — Retratos y escenarios en el mismo estilo cartoon (hoy desentonan con las cartas).
3. Spec 006 — Variar el patrón de banda por leyenda y efectos propios de cada rival.
4. Spec 007 — Elegir qué suma levantar cuando hay varias; modo «2 de 3 chicas»; estadísticas.

## Bloqueos / pendientes del usuario
- Confirmar si tras una suma se continúa la escalera hacia las figuras (7 → J → Q → K) o no (`ESCALERA_TRAS_SUMA`).
- Conseguir `vientos_pasacalle.mp3` y registrar la licencia de los 5 MP3 en `www/audio/LEEME.md`.
- Escuchar el pasacalle y decidir si el tempo/instrumentación convence.
- Confirmar el cuarto palo (Campanas de San Francisco) y las variantes de reglas de su casa.

## Riesgos conocidos
- Las reglas del Cuarenta varían por familia y barrio: puede que algún jugador espere otra variante.
- Cantuña ganó las 3 partidas simuladas contra la IA del Gallo: revisar que no sea frustrante para jugadores nuevos.

## Bitácora de sesiones
- 2026-10-04 — Proyecto creado (SDD). Spec 001: reglas verificadas y configurables, 4 leyendas con IA y frases, estados, sonido, vista previa de jugadas. Smoke 31/31.
- 2026-10-04 — Spec 002 (v1.1.0): audio.js y draw.js separados, palos vectoriales rediseñados, reverso azul/rojo, pasacalle procedural, lanzamiento flotante, diablillos. Corregidos 2 solapes de v1.0. Smoke 37/37.
- 2026-10-04 — Spec 003 (v1.2.0): estilo cartoon propio (sin referencias adjuntas), Rey diablo, Sota Padre Almeida, Caballo Chulla, As con angelito/diablillo, perros y tantos reemplazan las rayas, ParticleSystem, Lerp lineal con targetX/targetY. Smoke 39/39.
- 2026-10-04 — Spec 004 (v1.3.0): audio.js por muestras (preloadAudio, secuenciador 130 BPM, playCaida/playCaidaYLimpia/playPerro, window.CU_AUDIO) con respaldo sintetizado. Corregida precarga concurrente duplicada. audio 12/12, smoke 40/40.
- 2026-10-04 — v1.3.1 (QA): etiquetas J/Q/K, campo `nominal` (J=10, Q=11, K=12), `validateSuma()`; `bestSum()` excluye figuras por sí mismo (antes una figura contaba 0); quitado flag muerto `SUMA_SOLO_NUMEROS`. Smoke 50/50, audio 12/12.
- 2026-10-05 — v1.4.0: audio con MP3 reales (5/6; vientos sintetizados), usingSynthesizer, salto de silencio inicial, música solo tras «Jugar», robo de voz. Audio 15/15, smoke 53/53.
