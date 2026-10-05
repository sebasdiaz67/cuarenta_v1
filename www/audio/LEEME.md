# www/audio — muestras del juego

Formato de producción: **MP3** (`CFG.EXT = 'mp3'`). Coloca aquí los 6 archivos. Si falta alguno, el juego usa su equivalente sintetizado (y lo indica en el menú: «Audio: …»).

| Archivo | Uso | Duración recomendada | Notas |
|---|---|---|---|
| `bombo.mp3` | Bucle, tiempos 1-2-3 | 0.2–0.4 s | Golpe seco, sin cola larga. Ataque en el primer milisegundo (sin silencio inicial). |
| `platillo.mp3` | Bucle, tiempo 2 | 0.2–0.5 s | Platillo/platos de banda de pueblo. |
| `vientos_pasacalle.mp3` | Bucle, tiempo 4 | **≤ 0.46 s** (1 tiempo a 130 BPM) | Más largo se solapa con el compás siguiente; o activar `CFG.VIENTOS_MAX_S`. |
| `latigo.mp3` | Caída | 0.1–0.3 s | Chasquido seco e impactante. |
| `risa_diablo.mp3` | Caída + limpia y jugadas de Cantuña | 0.6–1.2 s | Carcajada pícara. |
| `perro_ladrido.mp3` | Completar un perro (10 puntos) | 0.2–0.5 s | Ladrido nítido. |

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

## Estado (v1.4.0)
- Presentes: bombo, platillo, latigo, risa_diablo, perro_ladrido (copiado de `tests/fixtures/audio/ladrido.mp3`).
- **Falta:** `vientos_pasacalle.mp3` → se sintetiza (onda cuadrada filtrada).
- El silencio inicial (incluido el retardo de ~20 ms del codificador MP3) se salta automáticamente.
- Pendiente: registrar aquí la fuente y licencia de cada archivo.

## Música de fondo (v1.5.0)
- `fondo_chulla_piano.mp3`: recorte a 63 s (sin recodificar) de `chulla_quiteño_piano.mp3`. Se repite en bucle desde ~0.37 s hasta 63.0 s.
- `chulla_quiteño_piano.mp3` (original, 73 s) **no lo usa el juego**: conviene sacarlo de `www/` para que no se empaquete en el APK (+810 KB) y evitar la «ñ» en nombres de archivo.
- ⚠️ Licencia: «El Chulla Quiteño» es obra protegida; la grabación también tiene derechos. Registrar aquí autorización/licencia antes de publicar.
