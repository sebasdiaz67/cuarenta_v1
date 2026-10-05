# Spec 007 — Reglas alineadas con el manual «Reglas para jugar 40»

**Estado:** Implementada · **Fecha:** 2026-10-05 · **Proyecto:** cuarenta · **Versión:** 1.8.0
**Fuente:** `docs/40.Rules.es.pdf` (16 secciones). Adaptación a 1 contra 1: «pareja» = jugador.

## Auditoría (manual vs. código anterior)
| § | Manual | Antes | Ahora |
|---|---|---|---|
| 2/15 | Partida a 2 de 3 chicas | Una sola chica | ✔ `CHICAS_PARA_GANAR: 2`, pantalla «Fin de chica», cartel solo al ganar la partida |
| 5C | Escalera desde la carta **igual** | También tras suma | ✔ `ESCALERA_TRAS_SUMA: false` (variante configurable) |
| 6 | Caída = igual a la carta previamente jugada | ✔ (v1.4.1) | Sin cambio; entre manos sigue anulada (decisión del usuario) |
| 8 | Caída y limpia: «2 puntos más el permiso de burlarse» | 4 | 4 (2 + 2) por decisión del usuario |
| 9 | Ronda: quien **supera 30** ya no la cobra | Solo bloqueada en 38 | ✔ `RONDA_MAX_SCORE: 30` |
| 10 | El juez **retira** las sobrantes | Al último que levantó | ✔ `SOBRANTES_AL_ULTIMO: false` (aviso en mesa) |
| 10B | «Dos por dar» a quien reparte **a continuación**; también con empates bajo 20 | Al que repartió | ✔ |
| 10C | «Dos por falla»: 0 cartas → +2 al rival | No existía | ✔ `DOS_POR_FALLA: 2` (se suma al cartón; no con 38) |
| 11 | 38 que no juega | ✔ | Sin cambio (bloquea también falla y dos por dar) |
| 15A | Cuatro iguales ganan la chica | ✔ | Ahora gana la **chica** (no la partida) |
| 15B | 4 caídas seguidas ganan la chica | No existía | ✔ `CAIDAS_SEGUIDAS: 4`: turnos consecutivos; se corta si no hay caída o si el rival hace una (decisión del usuario) |
| 16 | Zapatería: menos de 10 puntos al terminar la chica | No existía | ✔ título en fin de chica y pantalla final |
| 1, 4, 12–14 | 2 parejas, Juez de Aguas, arranque por cartas altas, mal repartidas, «veo y juego», carta lanzada | — | No aplican al formato digital 1 contra 1 (el motor es el juez; el levante es automático y siempre máximo) |

## Online
El servidor aplica las mismas reglas (`rules.js` compartido) y emite `chicaOver` / `gameOver` con `chicas` y `zapateria`; el conteo incluye `cartonTo`, `dosPorDar` y `falla`.

## Criterios de aceptación
- [x] Smoke 80/80 (+10 casos del manual y flujo de chicas) · match 15/15 (300 partidas a 2 de 3 chicas, ~150 000 jugadas, los tres motivos de victoria) · online 16/16 · audio 23/23.
