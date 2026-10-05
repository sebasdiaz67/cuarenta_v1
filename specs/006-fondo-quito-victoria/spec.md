# Spec 006 — Fondo del Centro Histórico de Quito y pantalla de victoria

**Estado:** Implementada · **Fecha:** 2026-10-05 · **Proyecto:** cuarenta · **Versión:** 1.7.0

## Requisitos
### R1 — Horizonte (franja y≈18–150)
- Iglesia de San Francisco estilizada: fachada de piedra, dos torres simétricas con campanarios y cruces, cúpulas con borde dorado tenue, portada con arco, ventana del coro y gradas del atrio.
- Tonos azul medianoche andino (`#070d24 → #22346a`), contornos limpios `#3a5296`, ventanas cálidas a baja opacidad. Casas coloniales con ventanas encendidas y estrellas fijas.
### R2 — El Panecillo
- Loma curva a la derecha, detrás de la iglesia, con la Virgen alada en la cima: silueta simplificada (alas, manto, corona de estrellas), trazo plateado y halo radial tenue.
### R3 — Integración con el paño
- El paño se compone con una máscara de degradado vertical (transparente en y=135, opaco en y=215): la ciudad se funde en el verde sin línea de corte.
- Todo se pinta UNA vez en el paño pre-renderizado → costo por fotograma = 0 (render p95 ≈ 1.8 ms con CPU ×4).
- `CFG.FONDO = 'quito'` (por defecto) · `'rival'` vuelve a las escenas propias de cada leyenda. Con Quito se mantienen los banderines y las brasas de Cantuña.
### R4 — Victoria del jugador
- Cartel de cómic: «¡GANASTE! / ¡LA CHICA!» gigante con tinta gruesa, sombra desplazada y doble estallido animado.
- Frase literal y destacada: «¡Qué bien chullita, tómate un canelazo por haber ganado!» (`CU.TEXT.victoriaFrase`).
- Dos copas de canelazo (naranja → canela, rama de canela, vapor) que se acercan, chocan («¡CHIN!» con destello) y se separan en bucle.
- Confeti (90, con giro aparente) y serpentinas (7) en pool fijo, siempre DETRÁS del cartel para no tapar la frase.
- Solo en victoria del jugador (IA u online); derrota y partida interrumpida mantienen su pantalla.

## Decisiones
> ⚠️ Las siluetas propias de cada leyenda (La Ronda, Catedral, San Diego) se reemplazan por el horizonte de Quito; recuperables con `CFG.FONDO = 'rival'`.
> ⚠️ La parte baja de la fachada queda detrás de la mano del rival (y≈145–207): la composición se diseñó para leerse entre los banderines y esa mano.

## Criterios de aceptación
- [x] Smoke 70/70 (+4: fondo activo, frase literal, confeti al ganar, sin confeti al perder) · match 15/15 · audio 21/21 · online 15/15.
