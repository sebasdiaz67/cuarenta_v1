# Spec 002 — Naipes quiteños, música de pasacalle y dinamismo

**Estado:** Implementada · **Fecha:** 2026-10-04 · **Proyecto:** cuarenta · **Versión:** 1.1.0

## Contexto
La v1.0.0 era jugable pero estática: palos sencillos, reverso genérico y sin música.

## Requisitos
### R1 — Separación de módulos (sin ES modules, compatible con `file://`)
- `js/audio.js` → `CU.Audio` (efectos + música; `CU.Sfx` queda como alias).
- `js/draw.js` → `CU.Draw` (primitivas, naipes, retratos, escenarios, partículas).
- `js/game.js` → reglas, IA, estados, entrada y composición de pantallas. Orden de carga: config → audio → draw → game.
### R2 — Cuatro brillos quiteños (vectores puros)
- Soles de Oro: sol incásico con dos coronas concéntricas de rayos y rostro del Inti (solo en tamaño grande).
- Corazones de la Basílica: corazón carmesí con arco ojival, parteluz, rosetón y cruz.
- Espadas de la Independencia: hoja delgada con vaceo, gavilanes dorados curvos, puño encordado y pomo.
- Campanas de San Francisco: campana colonial de bronce con asa, cordones, labio y badajo.
- Reverso: telar de rombos azul y rojo (colores de Quito) con hilo blanco, nudos dorados y medallón solar.
### R3 — Música procedural
- Pasacalle ORIGINAL en 2/4, 124 BPM, La menor armónica → Do mayor → dominante (16 compases en bucle).
- Quena: triángulo + vibrato (LFO compartido). Banda: diente de sierra con paso bajo a contratiempo. Tuba: cuadrada filtrada (raíz-quinta). Bombo, caja y platillo con ruido filtrado.
- Planificador lookahead (40 ms / 0.25 s) independiente de los FPS. `playBGM()` / `stopBGM()` públicos; arranca con el primer toque (política de autoplay); se detiene en la pantalla final; se suspende con la app en segundo plano.
### R4 — Dinamismo
- Lanzamiento flotante: jugar y repartir interpolan en 0.2 s (`ANIM_PLAY`, `ANIM_DEAL`), con inclinación en vuelo que se endereza al aterrizar.
- Diablillos procedurales (solo Cantuña): emisión ambiental en el atrio + ráfaga en caída/limpia del Diablo + chispas en cada levantada suya. Pool fijo de 80 partículas.
### R5 — Rendimiento
- Sprites cacheados por icono (no por carta: acota la RAM), sin `shadowBlur` por carta, pool sin asignaciones por frame. Meta: p95 de render < 16.7 ms con CPU ×4.

## Supuestos
> ⚠️ La melodía NO es «El Chulla Quiteño» (obra protegida, Alfredo Carpio): es composición propia en su estilo.
> ⚠️ Interpolación con frenado (`CARD_EASE: 'out'`) por defecto en lugar de Lerp lineal puro; se cambia en config.
> ⚠️ Colores de texto de palos ajustados: corazón `#b3122e`, campana bronce `#7a4a1c` (antes verde).

## Criterios de aceptación
- [x] Smoke 37/37 (31 previos + 6 de esta spec).
- [x] Render p95 2.5 ms con CPU ×4 y 80 partículas (Chromium headless; falta medir en celular real).
