# Diseño: Fase 3 — rendimiento y seguridad

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: ver `specs/`.

Estado observado en `main` (fase 2 fusionada, `c79e4dc`):

- `site/js/api/client.js`: `createFetchJson({ fetch, cache, timeoutMs, retries })`; `cache` es un puerto síncrono `{ get(url), set(url, valor) }` donde `undefined` en `get` es fallo; solo se guardan respuestas 2xx. `main.js` lo crea sin caché: `createFetchJson({})`.
- `site/js/core/load-section.js`: `FULL_LIST_LIMIT = 100000` (privado). Las URLs de lista son `…/<recurso>?limit=100000` (búsqueda en secciones paginadas), `…?limit=<tamaño>&offset=<n>` (paginación) y `…?limit=100` (naturalezas, tipos). Los detalles se piden con `Promise.all` sin límite; `fetchDetail` devuelve `null` ante rechazo o `!ok` y se filtra en silencio. El resultado `ok` es `{ status, items, page, totalPages, rawQuery }`; los tests de `load-section.test.js` lo comparan con `deepStrictEqual`.
- `site/js/ui/main.js`: `renderContent(view, result)` local (no testeable: el módulo arranca al importarse); `localStorageOrNull()` para el tema.
- `<img>` generados: `render-pokedex.js` (`sprite()`: tarjeta con `loading="lazy"`, ficha sin él) y `render-items.js` (sin atributos). Sprites de PokéAPI: Pokémon `front_default` 96×96, objetos `sprites.default` 30×30. No existe ningún `<img>` de logotipo: la cabecera usa puntos CSS (`.header-logo`, `.logo-dot`) y SVG en línea.
- `style=` generados: `render-pokedex.js` (barra, `width: N%`) y `render-natures.js` (dos `border-left`). El color sale de `STAT_GROUPS[].color` en `site/js/mappers/nature.js`; `pokedex.css` sobrescribe con `body[data-theme='gb'|'gray'] .acc-header[style] { border-left-color: … !important }`.
- Los 7 HTML: `preconnect` + hoja de Google Fonts, `pokedex.css`, `<script type="module" src="js/ui/main.js">`; sin `<style>`, sin `<script>` en línea, sin `on*=` ni `style=`.
- `scripts/check-html.mjs` compara el `<header>` de **todos** los `site/*.html` con `index.html`: una `404.html` sin marca activa haría fallar `check:html`. Solo mira el `<header>`, así que los cambios en `<head>` no le afectan.
- `npm test`: 230 tests. Herramientas locales: ImageMagick (`magick`), `ffmpeg`, Google Chrome 154, Node 24, Python 3.
- Fuentes en npm: `@fontsource/press-start-2p@5.3.0` y `@fontsource/vt323@5.3.0` publican `files/<familia>-latin-400-normal.woff2` y un `LICENSE` con la OFL 1.1 completa y el aviso de copyright de cada familia.

## Goals / Non-Goals

**Goals:**

- `core` sigue puro y con ≥ 95 % de mutación; todo módulo nuevo con lógica se testea en Node con fakes (sin red, sin DOM real, sin temporizadores reales).
- Cada requisito de `specs/` queda cubierto por un test automático, salvo los que solo se observan en un navegador real (consola sin violaciones de CSP, fuentes aplicadas, caché entre navegaciones), que se verifican con un navegador sin interfaz contra PokéAPI real.
- Cero dependencias nuevas en `package.json`.

**Non-Goals:**

- Service worker, modo offline, cabeceras HTTP, purgado activo de entradas caducadas, límite de tamaño de la caché.
- Tests completos de `render-*` y mutación de `ui` en la config principal (fase 4).
- Corregir `og:image` relativa (observación fuera de alcance del plan).

## Decisions

### D1. Cachés persistentes en `site/js/api/cache.js`

Módulo de adaptadores (capa `api`, `// @ts-check`, navegador) con tres fábricas que cumplen el puerto `{ get, set }` de `client.js`, sin acceso a globales: el almacenamiento y el reloj se inyectan.

| Fábrica | Almacén | Clave | Valor | Validez |
| --- | --- | --- | --- | --- |
| `createListCache({ storage, now = Date.now, ttlMs = 86_400_000 })` | `localStorage` | `pokedex:lista:<url>` | `JSON.stringify({ t, data })` | `now() - t < ttlMs` |
| `createDetailCache({ storage })` | `Map` propio + `sessionStorage` | `pokedex:detalle:<url>` | `JSON.stringify(data)` | sin caducidad |
| `createApiCache({ local, session, now })` | enruta a una de las dos | — | — | — |

- Enrutado: lista completa ⇔ `new URL(url).searchParams.get('limit') === String(FULL_LIST_LIMIT)`. `FULL_LIST_LIMIT` pasa a exportarse desde `load-section.js` (única fuente; `api` → `core` es la dirección de dependencia permitida). Cualquier otra URL, incluidas las listas paginadas y las de `limit=100`, va a la caché de detalles (spec «Caché de detalles por sesión»).
- Lectura tolerante (`get`): cualquier excepción de `getItem` o `JSON.parse`, o una forma inesperada, devuelve `undefined`. Forma válida de lista: objeto con `t` número finito y `data` objeto no nulo; de detalle: objeto no nulo. Una entrada caducada o corrupta no se borra: el siguiente `set` la sobrescribe (requisito «se ignoran y se sobrescriben»).
- Escritura tolerante (`set`): `setItem` dentro de `try/catch` silencioso (`QuotaExceededError`, `SecurityError`). En detalles, el `Map` se actualiza siempre, aunque falle `sessionStorage`; un acierto en `sessionStorage` también rellena el `Map`.
- `storage` puede ser `null` (acceso a `window.localStorage`/`sessionStorage` que lanza): la caché de listas no guarda nada y la de detalles queda solo en memoria.
- Límite de caducidad: `now() - t < ttlMs` estricto; a los 86 400 000 ms exactos es fallo (spec «Límite exacto de caducidad»).
- `main.js`: `localStorageOrNull()` se generaliza a `storageOrNull(nombre)` (`'localStorage'`/`'sessionStorage'`) y se crea `createFetchJson({ cache: createApiCache({ local, session }) })`. El tema sigue usando `localStorage`.
- Tests (`cache.test.js`) con fakes: almacenamiento sobre `Map` (`getItem` devuelve `null` si falta, como el real), almacenamiento cuyos métodos lanzan `DOMException('…', 'QuotaExceededError')`, `null`, y `now` fijo. Particiones: acierto, fallo, caducada (2 h → acierto, 25 h → fallo, límite 86 399 999 / 86 400 000), JSON inválido, JSON válido con forma inválida (`null`, `{ t: 'x' }`, sin `data`), lanzar en lectura/escritura, enrutado (`limit=100000` vs `limit=18&offset=0`, `limit=100`, detalle). Escenarios de spec «Búsqueda con lista en caché» y «Lista caducada» de extremo a extremo con `createFetchJson` + `createApiCache` + `fetch` falso que cuenta llamadas a la URL de lista.
- Alternativas descartadas: caché dentro de `client.js` (mezcla transporte y almacenamiento, rompe el puerto inyectable de la fase 2); clase con herencia (sin necesidad); IndexedDB / Service Worker (ADR 0002).

### D2. Límite de concurrencia: `site/js/core/limit.js` y contrato de `loadSection`

- `limit.js` exporta `createLimit(max)` → `run(task)`: `task` es una función que devuelve una promesa; `run` devuelve una promesa con su resultado. Como máximo `max` tareas activas; cola FIFO; al terminar una (cumplida o rechazada) arranca la siguiente; una tarea que lanza de forma síncrona se convierte en rechazo. `max` no entero o < 1 → `RangeError`. Puro: sin temporizadores ni globales.
- `load-section.js`: constante `MAX_DETAIL_REQUESTS = 6`; `fetchDetail` deja de devolver `null` y **lanza** ante `!ok` (y propaga rechazos y errores del mapper); `loadSection` hace `Promise.allSettled(names.map((n) => run(() => fetchDetail(…))))`, toma los `fulfilled` como `items` (orden por `id` como hoy) y añade `failedCount` = número de `rejected` al resultado `ok`. El resultado `error` (lista fallida) no cambia.
- Tests (`limit.test.js`) con promesas diferidas controladas a mano (sin temporizadores): 18 tareas con `max = 6` → máximo simultáneo 6 y 18 completadas; rechazo libera hueco; `max = 1` → serie; 4 tareas < `max` → las 4 empiezan a la vez; orden FIFO de arranque; tarea que lanza síncronamente → rechazo; `max` 0, −1, 1.5, `NaN` → `RangeError`. En `load-section.test.js`: escenario «Concurrencia» (cliente falso que registra peticiones en vuelo, 18 detalles → 6), «Fallos parciales» en `core` (18 detalles, 2 fallan → 16 `items`, `failedCount` 2), 404 de detalle cuenta como fallo, todos bien → `failedCount` 0; se actualizan los `deepStrictEqual` existentes con `failedCount`.
- Mutación: `limit.js` entra solo en la config principal (glob `core/**`); `thresholds.break` 95 se mantiene.
- Alternativa descartada: `mapWithLimit(items, max, fn)` que devuelve resultados asentados → oculta `Promise.allSettled` dentro de la utilidad y duplica su semántica; con `run` el uso de `allSettled` queda explícito en `loadSection`.

### D3. Del recuento en `core` al aviso en `ui`

- `core` solo devuelve un número (`failedCount`), sin textos ni HTML: la pureza y los tests de mutación de `core` no dependen de la UI.
- `strings.js`: `comun.elementoNoCargado: '1 ELEMENTO NO SE PUDO CARGAR'` y `comun.elementosNoCargados: 'ELEMENTOS NO SE PUDIERON CARGAR'` (la cifra se antepone en código). Cumplen el test de `STRINGS` (cadenas no vacías, congeladas).
- `layout.js` gana tres funciones de UI:
  - `failedNotice(count)` → `''` si 0; si no `<p class="page-info" role="status">…</p>` con `1 ELEMENTO…` o `${count} ELEMENTOS…`.
  - `sectionContent(view, result)` → sustituye a `renderContent` de `main.js` (se mueve para poder testearlo): error → mensaje de error; `items` vacío y `failedCount` 0 → `SIN RESULTADOS`; `items` vacío y `failedCount` > 0 → solo el aviso; si no, aviso (si lo hay) + elementos + paginación + overlays.
  - `applyStatBarWidths(root)` (D6).
- Tests en `site/js/ui/layout.test.js`: `failedNotice` con 0, 1, 2, 18 (valores límite); `sectionContent` con `pokedexView` y 16 Pokémon del fixture (ids distintos) + `failedCount` 2 → 16 `class="poke-card"` y el aviso (escenario «Fallos parciales»); 0 elementos + 18 fallos → aviso sin `SIN RESULTADOS`; 0 elementos + 0 fallos → `SIN RESULTADOS`; error → mensaje de error.
- Alternativa descartada: que `core` devuelva el texto del aviso → acopla `core` a la UI y a `strings.js`.

### D4. Fuentes autoalojadas

- Ficheros, descargados de jsDelivr con versión fijada `5.3.0`:
  - `https://cdn.jsdelivr.net/npm/@fontsource/press-start-2p@5.3.0/files/press-start-2p-latin-400-normal.woff2` → `site/fonts/press-start-2p-latin-400-normal.woff2`
  - `https://cdn.jsdelivr.net/npm/@fontsource/vt323@5.3.0/files/vt323-latin-400-normal.woff2` → `site/fonts/vt323-latin-400-normal.woff2`
  - `site/fonts/OFL.txt` = `LICENSE` de `@fontsource/press-start-2p@5.3.0` + línea en blanco + `LICENSE` de `@fontsource/vt323@5.3.0` (cada uno con su aviso de copyright y la OFL 1.1 completa).
- Solo el subconjunto `latin` (incluye `Á…Ú`, `Ñ`, `É`): los glifos ausentes (`▶`, `◀`, `╲`, `↑`, `↓`, `₽`) caen en `monospace`, igual que hoy con Google Fonts.
- `pokedex.css` empieza con dos `@font-face` (`font-weight: 400`, `font-style: normal`, `font-display: swap`, `src: url('../fonts/<fichero>.woff2') format('woff2')`); los `font-family` existentes no cambian. La URL relativa a la hoja funciona también desde `404.html`.
- Cada HTML: se eliminan los dos `preconnect` y la hoja de Google Fonts; se añaden dos `<link rel="preload" href="fonts/<fichero>.woff2" as="font" type="font/woff2" crossorigin />` antes de `pokedex.css` (`crossorigin` es obligatorio para que la precarga se reutilice).
- Alternativas descartadas: dependencia npm `@fontsource/*` (añade dependencia y copia en build); `woff` adicional (todos los navegadores objetivo soportan `woff2`); subconjunto `latin-ext` (sin uso en los textos actuales).

### D5. Atributos de imagen

- `render-pokedex.js`: `sprite()` pierde el parámetro `lazy`; tarjeta y ficha llevan `width="96" height="96" loading="lazy" decoding="async"` (la ficha está oculta hasta abrirse, así que diferirla evita descargar 18 sprites duplicados). `render-items.js`: `width="30" height="30" loading="lazy" decoding="async"`. El CSS actual (`140px`, `160px`, `40px`) sigue fijando el tamaño visual; los atributos reservan la proporción (CLS).
- Logotipo: hoy no hay `<img>` de logotipo (la cabecera es CSS + SVG en línea). La regla se protege en el test de D6: ningún `<img>` estático de `site/*.html` lleva `loading="lazy"`.
- Tests: dorados por atributo sobre la salida de `pokedexView` (tarjeta y ficha) e `itemsView` con fixtures, en `layout.test.js` o un `render-images.test.js` junto a ellos; sprite `null` → sin `<img>`.

### D6. CSP y eliminación de estilos en línea

- Meta exacta en los 8 HTML (7 + `404.html`), justo después de `<meta name="viewport">` y antes de cualquier `<link rel="stylesheet">`, `preload` o `<script>`:
  `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' https://raw.githubusercontent.com; connect-src https://pokeapi.co; manifest-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" />`
  - En `<meta>` no aplican `frame-ancestors`, `report-uri` ni `sandbox`; no se usan.
  - Los SVG en línea usan atributos de presentación (`fill`, `stroke`), no `style`: permitidos.
- Barras: `statRow` emite `data-valor="${statBarWidth(stat.baseStat)}"` (entero 0–100, ya limitado por el mapper). `layout.js` exporta `applyStatBarWidths(root)`: para cada `[data-valor]` de `root`, `el.style.setProperty('--ancho', el.dataset.valor + '%')` (CSSOM, permitido por `style-src 'self'`). `main.js` la llama tras cada `innerHTML`. CSS: `.stat-bar-fill { width: var(--ancho, 0); }` (se conserva la transición). Test con un `root` falso (`querySelectorAll` → elementos con `dataset` y `style.setProperty` espía).
- Naturalezas: la cabecera recibe `class="acc-header acc-stat-${group.stat}"` y la neutral `acc-header acc-stat-neutral`. `pokedex.css` define `.acc-stat-attack { border-left: 6px solid #e74c3c; }`, `defense #3498db`, `special-attack #9b59b6`, `special-defense #1abc9c`, `speed #f39c12`, `neutral #555`. Las reglas de tema `.acc-header[style] { … !important }` pasan a `body[data-theme='gb'] .acc-header { border-left-color: #306230; }` y `gray` `#555` (más específicas que `.acc-stat-*`; sin `!important`). `STAT_GROUPS` de `site/js/mappers/nature.js` pierde `color` (dato ya sin uso); el test «keeps the accent color of each stat group» pasa a comprobar que ningún grupo expone `color` (el de etiquetas existente ya cubre `stat` y `label`).
- Test `site/js/ui/csp.test.js` (spec «HTML sin código ni estilos en línea»), un subtest por origen:
  - Orígenes: cada `site/*.html` y la salida de `renderItems` (+ `renderOverlays` si existe) de las 7 vistas con su fixture mapeado por `SECTIONS[<sección>].mapper`.
  - Patrones: `/\sstyle\s*=/i`, `/<script(?![^>]*\ssrc\s*=)[^>]*>/i`, `/\son[a-z]+\s*=/i`.
  - Además, para cada HTML: exactamente una meta CSP con el contenido exacto, sin `unsafe-`; los dos `preload` de fuentes con `as="font"`, `type="font/woff2"` y `crossorigin`; ninguna referencia a `fonts.googleapis.com`/`fonts.gstatic.com`; ningún `<img … loading="lazy">` estático. `pokedex.css` contiene los dos `@font-face` con `font-display: swap` y los ficheros referenciados existen.
- `check:html` solo compara `<header>`: añadir CSP, `preload` y `manifest` al `<head>` de las 7 páginas no lo altera; se verifica explícitamente tras cada cambio de HTML.
- Alternativas descartadas: `'unsafe-inline'` o hashes de estilo (el requisito los prohíbe y los hashes no cubren atributos); variables CSS en un `<style>` generado (bloqueado por CSP); clases `w-0…w-100` (101 reglas frente a una propiedad personalizada).

### D7. Ficheros de publicación

- `site/404.html`: misma estructura de `<head>` que las páginas (charset, viewport, CSP, `title` `ERROR 404 — POKÉDEX`, `<meta name="robots" content="noindex">`, iconos, `preload`, `manifest`, `pokedex.css`) con rutas absolutas `/Pokedex-Retro/…`; sin `main.js` ni cabecera de navegación (no necesita datos ni JS; tema por defecto `normal`). Cuerpo: `<main class="site-main">` con `<h1 class="page-title">ERROR 404</h1>`, `<p class="page-info">PÁGINA NO ENCONTRADA</p>` y `<a class="page-btn" href="/Pokedex-Retro/index.html">VOLVER AL INICIO</a>`. Textos fijos en HTML, como el resto de páginas estáticas.
- `scripts/check-html.mjs`: `readPages` ignora `404.html` (`EXCLUDED_PAGES = ['404.html']`); las funciones puras no cambian. Test CLI: copia de `site/*.html` en un directorio temporal + `404.html` con cabecera distinta → código 0 sin mencionarla.
- `site/robots.txt`: `User-agent: *`, `Allow: /`, línea en blanco, `Sitemap: https://renzoramosdev.github.io/Pokedex-Retro/sitemap.xml`.
- `site/sitemap.xml`: `urlset` del esquema `http://www.sitemaps.org/schemas/sitemap/0.9` con 7 `<url><loc>https://renzoramosdev.github.io/Pokedex-Retro/<fichero>.html</loc></url>` (incluido `index.html`, para que cada `loc` se corresponda 1:1 con un fichero), sin `lastmod`.
- `site/manifest.webmanifest`: exactamente los campos del spec más `icons: [{ src: "images/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "images/icon-512.png", sizes: "512x512", type: "image/png" }]`. Cada HTML añade `<link rel="manifest" href="manifest.webmanifest" />` (absoluto en `404.html`). Prettier lo formatea como JSON.
- Iconos con ImageMagick, centrando el logotipo (499×500) sobre lienzo transparente cuadrado y sin metadatos variables:
  `magick site/images/logo-pokeball.png -resize 192x192 -background none -gravity center -extent 192x192 -strip site/images/icon-192.png` (igual con 512). Se versionan los PNG. Alternativa equivalente: `ffmpeg` con `scale`+`pad`; se elige `magick` por ser una sola orden legible.
- Test `site/js/site-files.test.js`: 404 (texto, enlace, todos los `href`/`src` empiezan por `/Pokedex-Retro/`), `robots.txt`, `sitemap.xml` (7 `loc` = base + cada `site/*.html` salvo `404.html`), manifiesto (campos exactos) y dimensiones PNG leídas de la cabecera IHDR (bytes 16–23) de cada icono declarado; cada HTML enlaza el manifiesto.
- Limitación conocida: los rastreadores solo leen `robots.txt` en la raíz del dominio; en un sitio de proyecto de Pages el fichero sirve de referencia y el sitemap se puede enviar a mano. Se mantiene por requisito.

### D8. Verificación en navegador real

Script desechable fuera del repositorio (directorio temporal con `npm i playwright-core@1.64.1` y `executablePath: '/usr/bin/google-chrome'`, sin cambiar `package.json`). Servidor estático local que reproduce la ruta de Pages: directorio temporal con enlace simbólico `Pokedex-Retro → <repo>/site` y `python3 -m http.server`. Comprueba contra PokéAPI real:

- Ninguna violación de CSP: escucha `securitypolicyviolation` (script de inicio) y mensajes de consola con `Content Security Policy`, en `index.html?q=char` con una ficha abierta (`#pokemon-4`), `naturalezas.html` y `/Pokedex-Retro/404.html`.
- Fuentes locales: todas las peticiones de tipo `font` van a `/Pokedex-Retro/fonts/`, ninguna a Google, y `document.fonts.check('16px "Press Start 2P"')` y `'16px VT323'` son `true` tras `document.fonts.ready`.
- Acierto de caché: tras la primera búsqueda existe `pokedex:lista:https://pokeapi.co/api/v2/pokemon?limit=100000` en `localStorage`; en la segunda búsqueda (`?q=pika`, mismo contexto) no hay ninguna petición a esa URL.
- Barras: en la ficha abierta, `getComputedStyle` de una `.stat-bar-fill` da `--ancho` igual a `data-valor` + `%`.

### D9. Commits

Asuntos del plan, más: `docs(openspec): añade el cambio de la fase 3`, `ci(html): excluye 404.html de la comparación de cabeceras` (antes de crear `404.html`, para que `check:html` no se rompa), `docs(readme): documenta la caché, la CSP y las fuentes propias` y el commit de archivo. El cableado de la caché en `main.js` entra en el commit de detalles (cuando existen las dos cachés y el enrutador). La eliminación de `color` del mapper entra en el commit de estilos en línea. Como en fases anteriores, el avance de casillas de `tasks.md` entra en el commit de archivo.

## Risks / Trade-offs

- [`localStorage` lleno por listas de ~100 KB de 7 recursos] → `set` silencioso; la web sigue sin caché. Sin purgado activo (fuera de alcance).
- [Datos hasta 24 h por detrás de PokéAPI] → aceptado en ADR 0002.
- [`sessionStorage` acumula detalles durante la sesión] → se libera al cerrar la pestaña; los fallos de cuota se ignoran y el `Map` sigue sirviendo.
- [Una CSP en `<meta>` no protege contra todo (sin `frame-ancestors`)] → Pages no permite cabeceras; aceptado y fuera de alcance.
- [Regex del test anti-en-línea con falsos positivos (`on…=` en texto)] → los textos se escapan y no contienen `=` tras palabras `on…`; un falso positivo se ve con el nombre de la vista y se corrige.
- [Subconjunto `latin` sin algunos símbolos] → caen en `monospace`, igual que hoy.
- [El modal pasa a `loading="lazy"`] → la imagen se descarga al abrir la ficha; con `width`/`height` no hay salto de maquetación.
- [Verificación en navegador depende de la red y de PokéAPI] → se ejecuta una vez al cierre; los tests automáticos no usan red.
- [Más trabajo por mutante en `core` por los tests de concurrencia] → tests sin temporizadores, deterministas; si la mutación supera 180 s se divide la config (regla común 5).

## Migration Plan

- Sin migración de datos: claves nuevas (`pokedex:lista:*`, `pokedex:detalle:*`); `theme` no cambia.
- Despliegue: merge a `main` → CI → Pages (`workflow_run`). Los nuevos ficheros estáticos se publican con `site/`.
- Marcha atrás: `git revert` del merge en una rama nueva + PR. Las entradas de caché que queden en navegadores son inofensivas (nadie las lee) y caducan o desaparecen con la sesión.
