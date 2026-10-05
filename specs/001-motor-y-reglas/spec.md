# Spec 001 — Motor, reglas del Cuarenta y leyendas

**Estado:** Implementada · **Fecha:** 2026-10-04 · **Proyecto:** cuarenta

## Contexto
Juego de cartas Cuarenta (tradición ecuatoriana) contra cuatro leyendas de Quito, ambientado en las Fiestas de Quito. Canvas 2D + JS vanilla, offline, `file://`.

## Requisitos
### R1 — Motor
- Paso fijo a 60 Hz con acumulador; 360×640 vertical; `devicePixelRatio` (tope 3) dentro del área segura.
### R2 — Estados
`MENU → REPARTIR_CARTAS → TURNO_JUGADOR ⇄ TURNO_IA → VALIDAR_JUGADA → … → CONTEO_CARTON → … → JUEGO_TERMINADO`.
### R3 — Reglas (verificadas con Tabletopia «Reglas del 40» y play40.app)
- Baraja de 40 (As, 2–7, J, Q, K; nominales J=10, Q=11, K=12; sin 8 ni 9); 5 cartas por jugador, 4 repartos por mazo; empieza el que no da.
- Levantar por igual; por suma (solo As–7); escalera ascendente después de igual o suma.
- Caída +2, limpia +2, ronda +2, cuatro iguales gana; cartón 20+ = 6 +1 por carta extra (par); empate = dos por dar; regla de 38 (solo caída). Gana quien llega a 40.
- Variantes configurables en `CU.RULES`.
### R4 — Rivales
- Chulla (agresivo), Gallo (defensivo), Padre Almeida (impredecible), Cantuña y el Diablo (cuenta cartas). Frases quiteñas por situación (saludo, caída, limpia, sufrir, 38, ganar, perder).
### R5 — Jugabilidad y sonido
- Primer toque: vista previa de lo que levanta (caída/limpia); segundo toque: jugar. Avisos de caída, limpia, ronda, cartón. Efectos de sonido sintetizados; silenciable.

## Fuera de alcance (siguientes specs)
- Música de pasacalle, modo 2 de 3 chicas, partidas en pareja (4 jugadores), elegir qué suma levantar cuando hay varias.

## Supuestos
> ⚠️ Con varias sumas posibles se levanta automáticamente la que más cartas toma.
> ⚠️ «Campanas de San Francisco» como cuarto palo: propuesta (el usuario nombró tres).
> ✔ v1.3.1: figuras con id y etiqueta J, Q, K (antes la etiqueta mostraba S, C, R). Orden de escalera 1…7, J, Q, K.
> ✔ v1.3.1: la suma excluye figuras dentro de `bestSum()` y `validateSuma()` (antes dependía del filtro de quien llamaba). Eliminado el flag `SUMA_SOLO_NUMEROS`, que no tenía efecto.
> ⚠️ Con `ESCALERA_TRAS_SUMA: true`, un 7 que suma 3+4 sigue la escalera y levanta también la J (por escalera, no por suma). Pendiente de confirmar con el reglamento del usuario.
> ✔ v1.4.1 — **Bug de caída corregido:** antes bastaba con que la última carta del rival estuviera entre lo levantado (la escalera A propio → 2 del rival daba caída falsa). Ahora `checkCaida()` exige que la carta emparejada por igual sea exactamente `lastPlayedCard`. `lastPlayedCard` se borra tras cada levantada y al inicio de cada mano (`CAIDA_ENTRE_REPARTOS: false`).
> ⚠️ Confirmar con el reglamento si la última carta de una mano puede «caerse» con la primera de la siguiente (hoy: no).
> ✔ v1.8.0 — Reglas contrastadas con el manual del usuario (`docs/40.Rules.es.pdf`); ver [spec 007](../007-reglas-del-manual/spec.md). Resuelve las dudas de escalera tras suma (no) y caída entre manos (anulada, decisión del usuario).
