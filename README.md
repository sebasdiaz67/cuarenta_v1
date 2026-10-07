# Cuarenta: El Juicio de las Leyendas

El juego de cartas de Quito contra cuatro leyendas de la ciudad, ambientado en las Fiestas de Quito.
HTML5 Canvas 2D + JavaScript vanilla: **el cliente no tiene dependencias, ni módulos ES, ni archivos de imagen**. Contra la IA funciona sin conexión y con doble clic (`file://`). El modo **online 1 contra 1** usa un servidor Node (`server.js`).

**Versión:** 1.9.0 · **Autor:** Byron Sebastián Rosero Díaz — Ingeniero de Software

---

## Índice
1. [Cómo se juega](#cómo-se-juega)
1. [Modo online](#modo-online)
2. [Reglas](#reglas)
3. [Rivales e IA](#rivales-e-ia)
4. [Sonido y música](#sonido-y-música)
5. [Imágenes y arte](#imágenes-y-arte)
6. [Animación y rendimiento](#animación-y-rendimiento)
7. [Datos guardados en el dispositivo](#datos-guardados-en-el-dispositivo)
8. [Estructura del código](#estructura-del-código)
9. [Configuración](#configuración)
10. [Pruebas](#pruebas)
11. [Pendientes conocidos](#pendientes-conocidos)
12. [Fuentes y autoría](#fuentes-y-autoría)

---

## Cómo se juega
1. En el menú elige una leyenda (las estrellas indican la dificultad).
2. Primer toque sobre una carta de tu mano: se resalta lo que levantaría y se anuncia si es caída o limpia.
3. Segundo toque sobre la misma carta: la juegas. En teclado, las teclas **1–5** juegan directamente.
4. Gana la chica quien llegue primero a **40 puntos**; gana la **partida** quien gane **2 de 3 chicas**.

## Modo online
Menú principal → **«🤝 Jugar con un Amigo (Online)»** → uno pulsa **Crear Mesa** y comparte el código de 4 dígitos; el otro lo escribe y pulsa **Unirse a Mesa**.

```
npm install          # solo para el servidor (express, socket.io)
npm start            # http://localhost:8080 — sirve el juego y el modo online
```
- **Servidor autoritativo:** el servidor baraja (con `crypto`), reparte, valida cada jugada (turno y carta) y aplica **las mismas reglas** del juego (`www/js/rules.js` se usa en el navegador y en Node). Cada teléfono recibe solo su mano: el rival aparece como reversos. No se puede hacer trampa mirando el código.
- **Eventos:** `createRoom` → código · `joinRoom({code})` → `gameStart` · `playerMove({cardId})` → el servidor emite `game` (`deal`, `ronda`, `turn`, `played`, `carton`, `gameOver`) a cada jugador y `rivalMoved` al rival · `rivalLeft` si el otro sale.
- **Memoria del servidor:** las mesas se borran al desconectarse alguien, al volver al menú, 30 s después de terminar y a los 10 min si nadie se une. Tope de 5 000 mesas y 10 intentos de unirse por minuto.
- **Con doble clic (`file://`)** el modo online no está disponible (no hay servidor): el submenú lo explica.
- **Para el APK:** desplegar `server.js` con HTTPS (Render, Railway, VPS…) y poner su URL en `CU.NET.SERVER_URL` (`config.js`). Orígenes permitidos: variable `ALLOWED_ORIGINS` (por defecto localhost y Capacitor).
- Si el amigo sale o se cae la conexión: «Partida interrumpida» (nadie gana). Aún no hay reconexión.

## Reglas
Implementadas en `CU.Rules` (`js/rules.js`), como funciones puras compartidas por el juego local y el servidor online.
**Fuente principal:** el manual «Reglas para jugar 40» (`docs/40.Rules.es.pdf`, citado como §n), adaptado a 1 contra 1 (cada «pareja» es un jugador; el motor hace de Juez de Aguas). Las variantes se configuran en `CU.RULES` (`js/config.js`).

### Baraja
| Concepto | Valor |
|---|---|
| Cartas | **40** = 4 brillos × 10 valores |
| Valores | As, 2, 3, 4, 5, 6, 7, **J** (10), **Q** (11), **K** (12). **No hay 8 ni 9.** |
| Brillos (palos) | Soles de Oro · Corazones de la Basílica · Espadas de la Independencia · Campanas de San Francisco |
| ¿Influye el palo? | No. Solo cuenta el valor. |
| Orden de escalera | 1, 2, 3, 4, 5, 6, 7, J, Q, K |
| Valor para sumar | Solo As–7. **J, Q y K nunca suman**, ni entre sí ni con números. |

### Reparto
- 5 cartas a cada jugador, 4 repartos por mazo (5 × 2 × 4 = 40).
- Empieza a jugar el que **no** da. El que da se alterna en cada mazo.

### Cómo se levanta (orden de prioridad)
1. **Por igual:** una carta del mismo valor. Si una de ellas es la que el rival acaba de jugar, se toma esa (para que valga la caída).
2. **Por suma:** solo si no hubo igual y la carta jugada es As–7. Se busca la combinación de cartas As–7 que sume exactamente su valor (mínimo 2 cartas). Si hay varias, se toma automáticamente la que más cartas levanta.
3. **Escalera (§5C):** solo a partir de la carta **igual**: se siguen levantando las consecutivas ascendentes … 6, 7, J, Q, K, hasta el primer valor que falte. Tras una suma **no** se sigue (variante `ESCALERA_TRAS_SUMA`).
4. Si no levanta nada, la carta se queda en la mesa.

Ejemplos verificados en las pruebas:
- 5 sobre [5] → levanta el 5.
- 4 sobre [4, 5, 6, K] → levanta 4, 5, 6 (falta el 7: la K no entra).
- 7 sobre [3, 4, K] → levanta 3 + 4.
- 7 sobre [3, 4, J] → 3 + 4 (la J no: tras una suma no hay escalera, §5C).
- K sobre [5, 7] → no levanta. K sobre [J, Q] → no levanta (las figuras no suman).

### Puntos
| Jugada | Puntos | Condición |
|---|---|---|
| **Caída** | +2 | Emparejar **por igual** la carta exacta que el rival lanzó en el turno inmediatamente anterior. No cuenta si esa carta solo se levanta por escalera o por suma. |
| **Limpia** | +2 | Dejar la mesa vacía. Se acumula con la caída (caída y limpia = 4). |
| **Ronda** (§9) | +2 | Recibir tres cartas del mismo valor. No vale si ya tienes **más de 30** puntos. |
| **Cuatro iguales** (§15A) | gana la chica | Recibir las cuatro del mismo valor: el marcador sube a 40. |
| **4 caídas seguidas** (§15B) | gana la chica | Caída en 4 turnos tuyos consecutivos; se corta si no haces caída o si el rival te hace una. |
| **Cartón** | 6 + 1 por carta sobre 20, redondeado a par | Al terminar el mazo, quien tiene más cartas (con 20 o más). 20 → 6, 21–22 → 8, 23–24 → 10, 30 → 16. |
| **Dos por dar** (§10B) | +2 | Empate en el número de cartas: los recibe quien **reparte a continuación**. |
| **Dos por falla** (§10C) | +2 | Si el rival no levantó ni una carta en el mazo. |

- **Regla de 38:** con 38 puntos solo vale la caída. No suman la limpia, la ronda ni el cartón. Cuando el rival llega a 38 lo avisa: «¡Treinta y ocho que no juegan!».
- **Sin caída pendiente:** después de cualquier levantada (incluida la limpia) y al empezar cada mano (`CAIDA_ENTRE_REPARTOS: false`) no hay carta del rival que se pueda «caer».
- **Ejemplo (bug corregido en v1.4.1):** mesa [A propio, 2 recién lanzado por el rival]; juegas otro A → levantas A y 2 (igual + escalera) y haces limpia (+2), pero **no** caída: emparejaste tu propio As.
- **Sobrantes (§10):** el juez **retira** las cartas que quedan en la mesa al final del mazo; no cuentan para nadie.
- **Zapatería (§16):** terminar una chica con menos de 10 puntos (es un título, no cambia el marcador).
- **Partida (§2):** a 2 de 3 chicas; entre chica y chica el marcador vuelve a 0 y las chicas ganadas se ven como círculos dorados junto a «Tú» y «Rival».
- **Victoria de la chica:** el primero en llegar a 40 (o por cuatro iguales / 4 caídas seguidas). La comprobación se hace después de cada jugada, de cada ronda y del cartón.

### Marcador: perros y tantos
El puntaje se muestra con el marcador tradicional en lugar de rayas:
- **Perro** (carta verde manzana con un perrito corriendo) = 10 puntos.
- **Tanto** (carta naranja con un «2») = 2 puntos.
- Ejemplo: 24 puntos = 2 perros + 2 tantos.

Al sumar puntos, la carta aparece en grande y vuela hasta el marcador. Si el puntaje cruzó una decena es un perro (y suena el ladrido); si no, un tanto.

## Rivales e IA
Definidos en `CU.RIVALS` (`js/config.js`). Cada rival tiene leyenda, colores, escenario y frases quiteñas para cada situación: saludo, caída, limpia, sufrir una caída, 38, ganar y perder.

| Leyenda | Escenario | Estilo de juego | Dificultad |
|---|---|---|---|
| El Chulla Quiteño | La Ronda | Busca puntos y cartas ya; arriesga mucho | ★☆☆☆ |
| El Gallo de la Catedral | Plaza Grande | Defensivo: evita dejar caídas | ★★☆☆ |
| El Padre Almeida | Convento de San Diego | Impredecible (mucho azar) | ★★★☆ |
| Cantuña y el Diablo | Atrio de San Francisco | Cuenta las cartas que ya salieron y mira una jugada adelante | ★★★★ |

**Cómo decide la IA** (`aiChoose`): para cada carta de su mano calcula un puntaje con estos pesos (`style` de cada rival):
- `points`: puntos inmediatos de la jugada.
- `cards`: cantidad de cartas que levanta.
- `risk`: probabilidad de que el rival tenga la carta para hacerle caída o limpia (cálculo hipergeométrico).
- `noise`: azar.
- `memory`: si cuenta las cartas vistas. Sin memoria asume un mazo promedio.
- `lookahead`: evita regalar escaleras.

Juega la carta con el mejor puntaje, tras una pausa «humana» de 0.7 a 1.3 s.

## Sonido y música
Todo en `js/audio.js` (`window.CU_AUDIO`, alias `CU.Audio` / `CU.Sfx`). Web Audio API, sin librerías.

### Arquitectura
```
preloadAudio() ─ fetch ─► decodeAudioData ─► AudioBuffer (caché)
[efectos] ─► sfxBus ─┐
                     ├─► master ─► altavoz
[música]  ─► bgmBus ─┘
```
- Cada sonido crea su propio nodo y lo libera al terminar (`onended`). Tope de **24 voces**: si se llena, se apaga la más vieja y el sonido nuevo siempre suena.
- Al decodificar se mide el silencio inicial de cada muestra y se salta al disparar (el látigo trae ~210 ms; todos los MP3 traen ~20 ms de retardo del codificador).
- La música se agenda con el reloj de audio (`audioCtx.currentTime`). Un temporizador cada 25 ms agenda los próximos 120 ms, así que el tempo no depende de los FPS.
- Los efectos se habilitan con el primer toque (política de autoplay). La **música solo se inicia al pulsar «Jugar»** (elegir una leyenda); después sigue en el menú y en las revanchas. Se pausa con la app en segundo plano.
- El botón **Sonido: SÍ/NO** del menú silencia todo y recuerda la elección.

### Muestras de audio (`www/audio/`, MP3)
| Archivo | Estado | Cuándo suena |
|---|---|---|
| `bombo.mp3` | ✔ 1.04 s | Música: tiempos 1, 2 y 3 |
| `platillo.mp3` | ✔ 1.33 s | Música: tiempo 2 |
| `vientos_pasacalle.mp3` | ✘ **falta** (se sintetiza con onda cuadrada filtrada) | Música: tiempo 4 (máximo 0.46 s) |
| `latigo.mp3` | ✔ 1.10 s | **Caída** (`playCaida`) y caída + limpia |
| `risa_diablo.mp3` | ✔ 4.01 s | **Caída + limpia** (180 ms después del látigo) y jugadas fuertes de Cantuña |
| `perro_ladrido.mp3` | ✔ 1.03 s (copia de `tests/fixtures/audio/ladrido.mp3`) | Completar un **perro** (`playPerro`) |
| `fondo_chulla_piano.mp3` | ✔ 63.03 s · 665 KB (recorte sin recodificar de `chulla_quiteño_piano.mp3`) | **Música de fondo** en bucle cada 1 min 3 s |

El menú indica el modo activo: «Audio: Muestras», «Audio: Mixto (5/6 muestras)» o «Audio: Sintetizado» (`usingSynthesizer = true`: con `file://` o sin bombo).

### Música de fondo
Prioridad: **1) piano** → 2) banda con muestras → 3) pasacalle sintetizado.
- **Piano:** `fondo_chulla_piano.mp3` en bucle nativo de Web Audio (un solo nodo, sin huecos): repite el tramo desde el fin del silencio inicial (~0.37 s) hasta **63.0 s**, que cae en una pausa natural de la pieza (62.5–63.0 s). Volumen propio (`PIANO_VOL`) porque viene ~11 dB más bajo que los efectos.
- ⚠️ **Derechos:** «El Chulla Quiteño» es una obra protegida, y la grabación al piano tiene además los derechos de quien la interpretó. Para publicar en Google Play hace falta licencia de la obra (SAYCE en Ecuador) y de la grabación, salvo que sea tuya y tengas la licencia de la composición.

#### Respaldo: «Banda de Pueblo Dicembrina»
- **Con muestras** (basta el bombo; las voces que falten se sintetizan): bucle a **130 BPM**: 1 bombo · 2 bombo + platillo · 3 bombo · 4 vientos (editable en `PATTERN`).
- **Sintetizado** (`file://` o sin bombo): pasacalle **original** en 2/4 a 130 BPM (La menor armónica → Do mayor → dominante, 16 compases): vientos con ondas cuadradas filtradas, bajo con ondas triangulares, banda a contratiempo y percusión. **No es «El Chulla Quiteño»**: esa obra está protegida.
- Se detiene en la pantalla final y vuelve con «Revancha» o «Menú».

### Efectos sintetizados (no tienen muestra)
| Efecto | Cuándo |
|---|---|
| Reparto | Cada carta repartida |
| Selección | Primer toque sobre una carta |
| Carta a la mesa | Al jugar |
| Levantar | Captura sin puntos |
| Limpia | Arpegio ascendente |
| Ronda | Acorde de tres notas |
| Tic | Conteo del cartón |
| Victoria / derrota | Fanfarria / caída melódica |

### Por qué `file://` no carga muestras
El navegador bloquea `fetch()` de archivos locales. Para oír las muestras sirve el juego por HTTP (`npx serve www`) o en Capacitor (`https://localhost`).

## Imágenes y arte
**El juego no usa archivos de imagen ni fuentes externas.** Todo se dibuja con vectores en Canvas 2D (`js/draw.js`, `CU.Draw`) con un estilo cartoon propio: contorno de tinta negra y colores planos saturados. Texto en la fuente del sistema (`system-ui`).

| Elemento | Descripción |
|---|---|
| **Soles de Oro** | Sol incásico con dos coronas de rayos y rostro del Inti (en tamaño grande) |
| **Corazones de la Basílica** | Corazón rojo con ventanal gótico en arco y cruz dorada |
| **Espadas de la Independencia** | Espada de hoja delgada con guarnición dorada cruzada, puño y pomo |
| **Campanas de San Francisco** | Campana colonial de bronce con asa, cordones y badajo |
| **As** | El palo en grande, con un angelito y un diablillo a los lados |
| **J (Jota)** | Padre Almeida: sombrero de teja, cara de juerguista asustado, pergamino del pacto con lacre |
| **Q (Caballo)** | El Chulla Quiteño montado en un caballito de palo |
| **K (Rey)** | Diablillo gordo y pícaro, cuernos rojos, corona, barba blanca y copa de canelazo |
| **Reverso** | Telar de rombos azul y rojo (colores de Quito) con medallón solar |
| **Perro / Tanto** | Cartas de puntos: verde con perrito / naranja con «2» y «caída por guapo · dos por shunsho» |
| **Fondo: Centro Histórico** | Horizonte nocturno azul medianoche con la **Iglesia de San Francisco** (dos torres, cúpulas con borde dorado, portada y gradas del atrio), casas coloniales iluminadas y **El Panecillo** con la **Virgen alada** en trazo plateado y halo tenue. Se funde con un degradado en el paño verde. `CFG.FONDO = 'rival'` vuelve a las escenas de cada leyenda |
| **Paño** | Fieltro verde de cantina con textura; fondo y paño se pintan una sola vez al iniciar (costo por fotograma = 0) |
| **Victoria** | Cartel de cómic «¡GANASTE! ¡LA CHICA!», la frase «¡Qué bien chullita, tómate un canelazo por haber ganado!», dos copas de canelazo que brindan («¡CHIN!»), confeti y serpentinas |
| **Banderines** | Banderines de fiesta sobre el horizonte; brasas en el atrio contra Cantuña |
| **Retratos** | Chulla, Gallo, Padre Almeida y Cantuña (estilo de la v1.0, aún sin pasar a cartoon) |
| **Diablillos** | Solo contra Cantuña: suben del atrio, y salen en ráfaga con chispas rojas y amarillas cuando el Diablo suma puntos |

La figura de cada carta lleva el color de su palo en la capa, la estola o el corbatín.

## Animación y rendimiento
- **Bucle:** `requestAnimationFrame` con paso fijo a 60 Hz (acumulador, máximo 8 pasos por fotograma).
- **Pantalla:** resolución lógica de 360×640 vertical, escalada al dispositivo. Usa `devicePixelRatio` (tope 3) y respeta el área segura (notch).
- **Cartas:** cada carta tiene `x, y` (posición actual) y `targetX, targetY` (destino). Se desliza por interpolación lineal en 0.2 s al jugar y al repartir, y se inclina en vuelo.
- **Optimizaciones para gama baja:**
  - Palos, figuras, reversos, perros, tantos y diablillos se dibujan una sola vez como imagen interna (sprite) a la resolución real y luego solo se copian.
  - Sin `shadowBlur` (es lo más caro del canvas); se usa una sombra desplazada.
  - Partículas en un pool fijo de 80, sin crear memoria nueva en cada fotograma.
- **Medido:** con la CPU emulada 4 veces más lenta y 80 partículas, el 95 % de los fotogramas se dibuja en 4 ms o menos (el límite para 60 FPS es 16.7 ms).

## Datos guardados en el dispositivo
Solo en `localStorage`. Sin cuentas, sin red y sin datos personales.

| Clave | Contenido |
|---|---|
| `cu.muted` | `1` si el sonido está apagado |
| `cu.wins.<rival>` | Veces que le ganaste a cada leyenda (no cuenta el modo online) |

## Estructura del código
```
www/index.html        canvas, metadatos de autoría, orden de carga de scripts
www/css/style.css     reset táctil, paño de fondo, área segura
www/js/config.js      metadatos, motor (CFG), reglas (RULES), baraja, brillos, rivales, rival online, red (NET), textos
www/js/rules.js       reglas puras (navegador y Node) → CU.Rules
www/js/audio.js       muestras, secuenciador, efectos sintetizados, autoplay → CU_AUDIO
www/js/draw.js        arte procedural, sprites, perros/tantos, retratos, escenarios, partículas → CU.Draw
www/js/net.js         conexión online (Socket.io bajo demanda) y submenú «Jugar con un Amigo» → CU.Net, CU.Lobby
www/js/game.js        IA, estados, modo online (cola de eventos), entrada, pantallas, bucle
server.js             servidor Express + Socket.io (salas, límites, CORS)
server/match.js       árbitro autoritativo de una partida online
www/audio/LEEME.md    especificación de las muestras de audio
tests/smoke.mjs       reglas + partida completa + rendimiento (file://)
tests/audio.mjs       motor de audio por HTTP con las muestras reales
tests/make-fixtures.mjs  (obsoleto) generaba WAV de prueba; ya no lo usa ninguna prueba
specs/                especificaciones SDD (001 motor y reglas · 002 arte, música y dinamismo · 003 arte cartoon · 004 audio)
```
Orden de carga obligatorio: `config.js` → `rules.js` → `audio.js` → `draw.js` → `net.js` → `game.js`.

**Estados del juego:** `MENU → MENU_IA | LOBBY → REPARTIR_CARTAS → TURNO_JUGADOR ⇄ TURNO_IA → VALIDAR_JUGADA → … → CONTEO_CARTON → … → JUEGO_TERMINADO`. Online: `TURNO_RIVAL_RED` (esperando la jugada del amigo) y `ESPERA_RED` (entre eventos del servidor).

## Configuración
| Dónde | Qué se ajusta |
|---|---|
| `CU.RULES` | `WIN_POINTS` (40), `CAIDA`, `LIMPIA`, `RONDA` (2), `CUATRO_IGUALES_GANA`, `ESCALERA_TRAS_SUMA`, `CAIDA_ENTRE_REPARTOS`, `CARTON_MIN` (20), `CARTON_BASE` (6), `CARTON_REDONDEO_PAR`, `REGLA_38`, `CARTON_BLOQUEO_30` (variante, desactivada), `SOBRANTES_AL_ULTIMO`, `DOS_POR_DAR` |
| `CU.CFG` | Tamaños de carta, tiempos de animación (`ANIM_PLAY`, `ANIM_DEAL`, `CARD_EASE`, `CARD_TILT`…), pausa de la IA, cantidad de diablillos (`IMPS`) |
| `CU_AUDIO.CFG` | Duración del bucle del piano (`PIANO_LOOP_END: 63`) y su volumen (`PIANO_VOL`), carpeta y extensión de las muestras (`EXT: 'mp3'`), umbral de silencio inicial (`LEAD_IN_DB`), BPM, volúmenes, tope de voces |
| `CU_AUDIO.PATTERN` | Patrón del bucle de banda |

## Pruebas
```
npm i -D playwright && npx playwright install chromium
npm test               # las 4 suites
node tests/smoke.mjs   # 80 comprobaciones (file://, audio sintetizado)
node tests/audio.mjs   # 23 comprobaciones (HTTP, con los MP3 reales de www/audio/)
node tests/match.mjs   # 15: árbitro (300 partidas) + protocolo Socket.io
node tests/online.mjs  # 16: dos navegadores reales juegan una partida completa contra server.js
```
Cubren:
- Reglas: baraja, nomenclatura J/Q/K, igual, suma, escalera, figuras que no suman, caída, limpia, regla de 38, ronda, cartón y dos por dar.
- Interfaz: tocar para elegir y jugar.
- Una partida completa automática, verificando que siempre haya 40 cartas en juego.
- Rendimiento con la CPU 4 veces más lenta, música, lanzamiento flotante, diablillos y perros/tantos.
- Audio: carga de los MP3, detección del archivo faltante, silencio inicial, música solo tras «Jugar», patrón exacto, desvío del ritmo menor a 1 ms, liberación de nodos y robo de voz con el cupo lleno.

## Pendientes conocidos
- Desplegar el servidor online con HTTPS y configurar `CU.NET.SERVER_URL` para el APK; reconexión tras caídas de red.
- Falta `vientos_pasacalle.mp3` (hoy se sintetiza). Confirmar la licencia de uso comercial de los 5 MP3.
- Pasar retratos y escenarios al estilo cartoon (hoy desentonan con las cartas).
- Probar en un celular real: legibilidad de las figuras en la mesa (50×72) y dificultad de Cantuña, que gana la mayoría de las partidas simuladas.
- Elegir qué suma levantar cuando hay varias (hoy es automático).

## Fuentes y autoría
**Reglas:**
- Manual «Reglas para jugar 40» (`docs/40.Rules.es.pdf`) — fuente principal desde v1.9.0
- Tabletopia — «Reglas del 40»: https://c.tabletopia.com/games/cuarenta/rules/reglas-del-40/es
- play40.app — Reglas del Cuarenta: https://play40.app/rules

Donde las fuentes difieren, la opción quedó configurable en `CU.RULES`.

**Arte y música:** diseño procedural original. No reproduce barajas comerciales ni canciones protegidas.

**Cuarenta: El Juicio de las Leyendas** · v1.9.0
Byron Sebastián Rosero Díaz — Ingeniero de Software
© 2026 Byron Sebastián Rosero Díaz. Ingeniero de Software. Todos los derechos reservados. Software propietario: ver [`LICENSE`](LICENSE).
