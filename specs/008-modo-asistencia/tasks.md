# Tasks 008 — Modo de asistencia

- [x] T1. Revisar si las capturas son automáticas y ubicar dónde se pintan las pistas.
      → Automáticas (`resolvePlay`); pistas en `drawPreview` (game.js). Documentado en spec.
- [x] T2. Estado de asistencia en game.js: `assist` (bool) + carga/guardado en `localStorage`
      (`cu.assist`, try/catch, por defecto Aprendizaje).
- [x] T3. Botón `BTN.mode` en el menú (junto a «Sonido»); dibujarlo en `drawMenu` con etiqueta
      `Modo: Aprendizaje` / `Modo: Experto` en menú principal y lista de leyendas.
- [x] T4. Manejar el toque de `BTN.mode` en `onTap` para los estados `MENU` y `MENU_IA` (alterna).
- [x] T5. Gatear `drawPreview()`: en Experto, sin resaltado ni texto de captura; aviso neutro.
      Asegurar `c.hl = false` en el camino de dibujo (línea del `else`).
- [x] T6. Exponer `assist` en `CU._debug` (getter + setter) para la prueba.
- [x] T7. Caso en `tests/smoke.mjs`: Aprendizaje marca `hl`; Experto no; el botón alterna
      `localStorage`.
- [x] T8. Bump de versión a v1.9.0 (META + cabeceras + index.html).
- [x] T9. Verificar: `node --check`, smoke en verde, y prueba visible en el navegador.
- [ ] T10. (Futuro, spec 009) Captura manual con validación en Experto; definir el caso de
      «el jugador no ve la captura».
