# Spec 004 — Audio por muestras y secuenciador «Banda de Pueblo Dicembrina»

**Estado:** Implementada (falta el audio real) · **Fecha:** 2026-10-04 · **Proyecto:** cuarenta · **Versión:** 1.3.0 (módulo de audio 1.0.0)

## Requisitos
### R1 — Carga
- `preloadAudio()` asíncrona e idempotente: `fetch` + `decodeAudioData` en paralelo (`Promise.allSettled`) de 6 muestras en `www/audio/`.
- Extensión configurable (`CFG.EXT`, por defecto `wav`).
### R2 — Secuenciador
- 130 BPM, reloj `audioCtx.currentTime`, lookahead 25 ms / 120 ms.
- Patrón (datos en `PATTERN`): 1 bombo · 2 bombo+platillo · 3 bombo · 4 vientos.
### R3 — Efectos de jugada (`window.CU_AUDIO`)
- `playCaida()` → látigo. `playCaidaYLimpia()` → látigo y risa a +180 ms. `playPerro()` → ladrido al cruzar una decena de puntos.
### R4 — Memoria y autoplay
- Un `AudioBufferSourceNode` por disparo, desconectado en `onended` (también los nodos sintetizados). Tope de 24 voces.
- `startBGM()` reanuda el contexto solo dentro de un gesto; el contexto se suspende con la app en segundo plano.

## Decisiones y supuestos
> ⚠️ **No hay muestras reales todavía.** `www/audio/` solo tiene `LEEME.md` con la especificación. Los WAV de `tests/fixtures/` son sintéticos y solo sirven para las pruebas.
> ⚠️ Con `file://` no se intenta `fetch` (Chrome lo bloquea): suena el respaldo sintetizado. Las muestras se oyen por HTTP o en Capacitor.
> ⚠️ Se conserva la síntesis como respaldo y para efectos sin muestra (carta, selección, tic, limpia, ronda, victoria, derrota).
> ⚠️ WAV no es comprimido; para estas duraciones (~300 KB) es aceptable. `CFG.EXT = 'ogg'` si crece.
> ⚠️ El patrón pedido es 4/4 parejo, no síncopado.
> ⚠️ El «PDF» citado (puntos 6, 8, 10 y 15) no se recibió; se implementó según el texto del pedido.

## Criterios de aceptación
- [x] `tests/audio.mjs` 12/12 por HTTP con muestras de prueba: patrón exacto, desvío < 1 ms a 130 BPM, voces liberadas, tope de polifonía.
- [x] `tests/smoke.mjs` 40/40 con `file://` (respaldo).
- [ ] Muestras reales grabadas o con licencia comercial, según `www/audio/LEEME.md`.
- [ ] Prueba en Android (Capacitor) con altavoz.

## v1.4.0 — Muestras MP3 reales
- `CFG.EXT = 'mp3'`; 5 de 6 muestras presentes. Falta `vientos_pasacalle.mp3`: esa voz se sintetiza y el resto del bucle usa muestras («Mixto»).
- `usingSynthesizer` (sin bombo o con `file://`) → menú «Audio: Sintetizado»; respaldo: vientos con ondas cuadradas filtradas, bajo con ondas triangulares.
- Detección y salto del silencio inicial por muestra (látigo ~210 ms; retardo MP3 ~20 ms en todas).
- Música armada solo al pulsar «Jugar» (`startBGM`); `resumeBGM` para revancha, menú y sonido.
- Polifonía: robo de la voz más vieja en lugar de descartar el sonido nuevo.
- [x] `tests/audio.mjs` 15/15 con los MP3 reales · `tests/smoke.mjs` 53/53.

## v1.5.0 — Fondo de piano
- `fondo_chulla_piano.mp3` (63.03 s) como música de fondo con `loop` nativo: `loopStart` = fin del silencio inicial, `loopEnd` = 63.0 s (pausa natural 62.5–63.0 s).
- Prioridad del fondo: piano → banda con muestras → sintetizado. Cambio en caliente si el piano termina de cargar con la banda sonando.
- ⚠️ Pendiente: licencia de la obra y de la grabación.
- [x] `tests/audio.mjs` 21/21 (piano en bucle a 63 s, stop/resume, respaldo de banda con el piano bloqueado).
