# www/audio — muestras del juego

Coloca aquí los 6 archivos. Si falta alguno, el juego usa su equivalente sintetizado (y lo indica en el menú: «Audio: …»).

| Archivo | Uso | Duración recomendada | Notas |
|---|---|---|---|
| `bombo.wav` | Bucle, tiempos 1-2-3 | 0.2–0.4 s | Golpe seco, sin cola larga. Ataque en el primer milisegundo (sin silencio inicial). |
| `platillo.wav` | Bucle, tiempo 2 | 0.2–0.5 s | Platillo/platos de banda de pueblo. |
| `vientos_pasacalle.wav` | Bucle, tiempo 4 | **≤ 0.46 s** (1 tiempo a 130 BPM) | Más largo se solapa con el compás siguiente; o activar `CFG.VIENTOS_MAX_S`. |
| `latigo.wav` | Caída | 0.1–0.3 s | Chasquido seco e impactante. |
| `risa_diablo.wav` | Caída + limpia y jugadas de Cantuña | 0.6–1.2 s | Carcajada pícara. |
| `perro_ladrido.wav` | Completar un perro (10 puntos) | 0.2–0.5 s | Ladrido nítido. |

## Formato técnico
- Mono, 44.1 kHz o 48 kHz, 16 bit. Normalizar a pico −1 dBFS; recortar silencios al inicio (el secuenciador dispara en el instante exacto).
- WAV **no está comprimido** (~88 KB/s en mono a 44.1 kHz). Para estas duraciones son ~300 KB en total: aceptable.
  Para reducir peso: exportar en `.ogg` (Vorbis/Opus) y cambiar `CFG.EXT = 'ogg'` en `js/audio.js` (Android WebView lo decodifica).

## Licencia
- Solo grabaciones propias o con licencia que permita uso comercial (p. ej. CC0). Guardar la fuente y la licencia de cada archivo aquí.
- No usar fragmentos de grabaciones comerciales (p. ej. de «El Chulla Quiteño»): la canción y las grabaciones están protegidas.

## Probar
- Con doble clic (`file://`) el navegador bloquea `fetch`: siempre sonará el respaldo sintetizado.
- Para oír las muestras: servir por HTTP (`npx serve www`) o en Capacitor (`https://localhost`).
