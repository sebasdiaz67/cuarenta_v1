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
- Baraja de 40 (As–7, Sota, Caballo, Rey); 5 cartas por jugador, 4 repartos por mazo; empieza el que no da.
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
> ⚠️ Sota/Caballo/Rey ocupan los valores 8/9/10 de J/Q/K de la baraja inglesa usada en Quito.
