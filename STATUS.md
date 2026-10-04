# STATUS — cuarenta

**Última actualización:** 2026-10-04
**Estado general:** v1.1.0 — Jugable contra 4 leyendas con naipes quiteños, música de pasacalle y diablillos. Sin empaquetado.

## Features
| Spec | Estado | Notas |
|---|---|---|
| [001-motor-y-reglas](specs/001-motor-y-reglas/spec.md) | Implementada | Smoke 31/31 |
| [002-arte-musica-dinamismo](specs/002-arte-musica-dinamismo/spec.md) | Implementada | Smoke 37/37 · render p95 2.5 ms (CPU ×4) |

## Próximos pasos (priorizados)
1. Probar en celular real: legibilidad de cartas y dificultad de cada leyenda.
2. Spec 003 — Variar la música por leyenda (el bucle de 16 compases puede cansar) y efectos propios de cada rival.
3. Spec 003 — Elegir qué suma levantar cuando hay varias; modo «2 de 3 chicas»; estadísticas.
4. Spec 004 — Arte de cartas y retratos de las leyendas (ilustración).

## Bloqueos / pendientes del usuario
- Escuchar el pasacalle y decidir si el tempo/instrumentación convence.
- Confirmar el cuarto palo (Campanas de San Francisco) y las variantes de reglas de su casa.

## Riesgos conocidos
- Las reglas del Cuarenta varían por familia y barrio: puede que algún jugador espere otra variante.
- Cantuña ganó las 3 partidas simuladas contra la IA del Gallo: revisar que no sea frustrante para jugadores nuevos.

## Bitácora de sesiones
- 2026-10-04 — Proyecto creado (SDD). Spec 001: reglas verificadas y configurables, 4 leyendas con IA y frases, estados, sonido, vista previa de jugadas. Smoke 31/31.
- 2026-10-04 — Spec 002 (v1.1.0): audio.js y draw.js separados, palos vectoriales rediseñados, reverso azul/rojo, pasacalle procedural, lanzamiento flotante, diablillos. Corregidos 2 solapes de v1.0. Smoke 37/37.
