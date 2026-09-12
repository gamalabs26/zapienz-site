# Fuentes de la casa

Las tres familias de la marca se sirven desde este dominio, no desde
fonts.googleapis.com. La razon es medida, no estetica: el LCP de escritorio
venia siendo igual al FCP en todas las corridas, o sea bloqueo de render, y ese
bloqueo incluia una hoja de estilo de un tercero con su DNS y su TLS antes de
pintar una sola letra.

Las tres estan bajo la SIL Open Font License 1.1, que permite alojarlas siempre
que el aviso de licencia viaje con ellas. Ahi estan los tres `ofl-*.txt`.

| Familia | Uso en el sitio | Licencia |
|---|---|---|
| Newsreader | titulares (`--display`) | `ofl-newsreader.txt` |
| Outfit | texto y H1 (`--sans`) | `ofl-outfit.txt` |
| IBM Plex Mono | rotulos y cifras (`--mono`) | `ofl-ibmplexmono.txt` |

Solo se bajaron los subconjuntos `latin` y `latin-ext`; los demas (cirilico,
griego, vietnamita) no los pide este sitio.

Las tres son fuentes variables, asi que varios pesos comparten el MISMO archivo
byte a byte: el de Outfit 400 es tambien el de 500, 600 y 700, y el de
Newsreader 400 es el de 500. Se dedujo por hash md5 y las `@font-face` apuntan
al archivo canonico. De 18 descargas quedaron 10 archivos: 766 KB a 414 KB.

Las declaraciones `@font-face` viven al principio de `assets/css/site.css`
(seccion "0b. FUENTES DE LA CASA"), no en un archivo aparte, para no agregar una
peticion en la ruta critica. Si algun dia se agrega un peso, hay que volver a
correr el dedup antes de commitear, o se suben 130 KB repetidos.
