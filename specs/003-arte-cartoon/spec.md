# Spec 003 — Arte cartoon quiteño, perros y tantos

**Estado:** Implementada · **Fecha:** 2026-10-04 · **Proyecto:** cuarenta · **Versión:** 1.2.0

## Contexto
El usuario pidió emular el estilo de una baraja comercial (Boonanza). No llegaron imágenes de referencia y copiar
personajes o cartas de un producto comercial no procede: se definió un **estilo cartoon propio** con los mismos rasgos
genéricos (contorno de tinta, colores planos saturados, caricatura satírica).

## Requisitos
### R1 — Estilo
- Contorno negro `#1a1110` en todas las piezas; colores planos (sin degradados) con una sombra/brillo plano como máximo.
### R2 — Figuras (caja 100×130 u, cacheadas como sprite)
- **Rey (K):** diablillo gordo y pícaro, cuernos rojos triangulares, corona, barba blanca, copa de canelazo con vapor, capa del color del palo.
- **Sota (J):** Padre Almeida con sombrero de teja, chapas de juerga, nariz colorada, ojos desorbitados, gota de sudor y pergamino del pacto con lacre; estola del color del palo.
- **Caballo (Q):** el Chulla Quiteño en caballito de palo (guiño, bigote fino, corbatín y crin del color del palo). *Decisión del usuario.*
- **As:** brillo grande del palo con un angelito y un diablillo a los lados.
### R3 — Perros y tantos (marcador tradicional; *decisión del usuario: reemplazan las rayas*)
- Perro = 10 puntos (verde manzana, perrito corriendo con la lengua afuera). Tanto = 2 puntos (naranja, círculo blanco con «2», borde «caída por guapo · dos por shunsho»).
- Marcador: 24 = 2 perros + 2 tantos. Al sumar, la carta de puntos aparece grande (frase legible) y vuela al marcador.
### R4 — Partículas
- `ParticleSystem` (clase, pool fijo de 80). Diablillo = círculo + dos triángulos por cuernos. Ráfaga cuando el Diablo suma **cualquier** punto: caída/limpia, ronda y cartón.
### R5 — Lerp
- Cada carta tiene `x, y` (actual) y `targetX, targetY` (destino). Lerp **lineal** por defecto (`CARD_EASE: 'linear'`).

## Decisiones y supuestos
> ⚠️ No se emiten ráfagas «en cada cambio de estado»: ocurre ~40 veces por mazo y sería ruido visual.
> ⚠️ «Juez de Aguas» no aparece en las fuentes de reglas consultadas; no se implementó como personaje.
> ⚠️ La frase del tanto solo se lee en tamaño grande (vuelo); en el marcador (15×21) se omite por nivel de detalle.
> ⚠️ Retratos y escenarios de los rivales siguen con el estilo de v1.0 y ahora desentonan con las cartas.

## Criterios de aceptación
- [x] Smoke 39/39 (marcador perros/tantos y Lerp lineal hacia targetX/targetY incluidos).
- [x] Render p95 ≤ 4.1 ms con CPU ×4 y 80 partículas (Chromium headless).
- [ ] Revisión del usuario en celular real (legibilidad de figuras a 50×72).
