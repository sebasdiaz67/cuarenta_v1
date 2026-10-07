# Spec 008 — Modo de asistencia: Aprendizaje vs. Experto

**Fecha:** 2026-10-06
**Estado:** Implementada (alcance acotado)
**Depende de:** 001 (motor y reglas), 002 (vista previa de jugadas)

## Qué y por qué
Hoy el juego siempre muestra una **vista previa de la jugada** (`drawPreview`): al seleccionar
una carta, resalta en la mesa qué cartas se levantan y escribe el texto
«Levanta 3 · CAÍDA +2 · LIMPIA +2» o «Se queda en la mesa». Es una ayuda muy útil para
aprender, pero elimina la tensión y resta rejugabilidad para quien ya sabe jugar Cuarenta.

Se añaden **dos modos de asistencia**, seleccionables y persistentes:
- **Aprendizaje** (por defecto): comportamiento actual, con pistas.
- **Experto**: sin pistas. No se resaltan cartas ni se muestra qué levanta la jugada.

## Hallazgo previo (requisito del plan)
**Las capturas son automáticas.** `playCard → resolvePlay → Rules.findCapture` toma siempre
la mejor jugada legal y levanta las cartas por sí mismo; el jugador nunca elige qué capturar.
Por tanto las pistas son **solo informativas** y ocultarlas **no cambia el resultado** de
ninguna jugada ni toca `rules.js`. Es un cambio de UX puro.

## Fuera de alcance (decisión pendiente, feature futura 4–8 h)
- **Captura manual con validación de jugada legal** en modo experto (que el jugador escoja
  qué cartas levantar y el motor valide). Incluye definir qué pasa cuando el jugador **no ve**
  una captura posible (¿se le obliga?, ¿pierde la captura?, ¿se penaliza?). Queda para spec 009.

## Requisitos
- R1. Selector de modo en el menú (botón junto a «Sonido»), con las etiquetas
  **`Modo: Aprendizaje`** / **`Modo: Experto`**. Visible en el menú principal y en la lista de
  leyendas. Un toque alterna el modo.
- R2. La preferencia se guarda en `localStorage` con la clave `cu.assist`
  (`'1'` = Aprendizaje, `'0'` = Experto). Tolerante a fallos (try/catch). Por defecto: Aprendizaje.
- R3. En modo **Experto**, al seleccionar una carta **no** se resaltan cartas de la mesa
  (`c.hl` queda en `false`) y **no** se muestra el texto de «Levanta … / Se queda en la mesa».
- R4. Se conserva el doble toque (elegir → confirmar). En Experto, al seleccionar se muestra
  solo el aviso neutro «Toca otra vez para jugar» (no es una pista: evita jugar sin querer).
- R5. El modo aplica igual contra la IA y en línea (la vista previa corre en `TURNO_JUGADOR`,
  común a ambos). El modo no se envía al servidor (es local al cliente).

## Verificación
- Smoke: en Aprendizaje, seleccionar una carta con captura marca `c.hl` en alguna carta de la
  mesa; tras cambiar a Experto, la misma selección **no** marca ninguna `c.hl`. El botón alterna
  `cu.assist` en `localStorage`.
- Visible: probar ambos modos en el navegador (bloque del 2026-10-06).
