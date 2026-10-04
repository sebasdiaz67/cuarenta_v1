# Cuarenta: El Juicio de las Leyendas

El juego de cartas de Quito contra sus leyendas, ambientado en las Fiestas de Quito. HTML5 Canvas 2D + JavaScript vanilla: sin dependencias, sin módulos ES, funciona sin conexión y con doble clic (`file://`).

## Rivales
| Leyenda | Escenario | Estilo | Dificultad |
|---|---|---|---|
| El Chulla Quiteño | La Ronda | Ataca y busca puntos ya; arriesga | ★☆☆☆ |
| El Gallo de la Catedral | Plaza Grande | Defensivo: no deja caídas fáciles | ★★☆☆ |
| El Padre Almeida | Convento de San Diego | Impredecible | ★★★☆ |
| Cantuña y el Diablo | Atrio de San Francisco | Cuenta las cartas que ya salieron | ★★★★ |

## Reglas implementadas
- Baraja de 40: As, 2–7, J (10), Q (11) y K (12) por brillo; sin 8 ni 9. Las cartas muestran J, Q, K. Cuatro brillos: Soles de Oro, Corazones de la Basílica, Espadas de la Independencia, Campanas de San Francisco. El palo no influye.
- Se reparten 5 cartas a cada uno, cuatro veces por mazo; empieza el que no da.
- **Levantar**: carta igual; **suma** de cartas As–7 (las figuras no suman); y luego **escalera** ascendente (… 6, 7, J, Q, K). Las figuras nunca suman: solo se capturan por igualdad o por escalera.
- **Caída** +2 (levantar con igual la carta que el rival acaba de jugar) · **Limpia** +2 (dejar la mesa vacía) · **Ronda** +2 (tres iguales al recibir) · **Cuatro iguales** gana la chica.
- **Cartón** al terminar el mazo: quien tenga más cartas, con 20 o más, suma 6 + 1 por carta extra (redondeado a par). Empate 20–20: dos por dar.
- **Regla de 38**: con 38 solo vale la caída (no limpia, ronda ni cartón).
- Gana quien llega a **40**.
- Variantes regionales configurables en `CU.RULES` (`config.js`): bloqueo del cartón desde 30, sobrantes al último que levantó, etc.

## Cómo se juega
Toca una carta de tu mano para ver qué levanta (se resaltan las cartas y se anuncia caída/limpia); tócala otra vez para jugarla. Teclado: 1–5.

## Estructura
```
www/index.html     canvas + metadatos de autoría
www/css/style.css  reset táctil, paño verde de cantina, área segura
www/js/config.js   lore, rivales y frases, baraja, reglas configurables, tiempos
www/js/game.js     1) reglas puras  2) sonido  3) IA  4) estados  5) entrada  6) render  7) bucle 60 Hz
tests/smoke.mjs    31 comprobaciones: 20 de reglas + partida completa automática
```

## Pruebas
```
npm i -D playwright && npx playwright install chromium
node tests/smoke.mjs
```

## Fuentes de las reglas
- Tabletopia — «Reglas del 40»: https://c.tabletopia.com/games/cuarenta/rules/reglas-del-40/es
- play40.app — Reglas del Cuarenta: https://play40.app/rules

## Autoría
**Cuarenta: El Juicio de las Leyendas** · v1.0.0
Byron Sebastián Rosero Díaz — Ingeniero de Software
© 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. Software propietario: ver [`LICENSE`](LICENSE).
