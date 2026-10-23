# Pokédex Retro

Pokédex retro estática sobre [PokéAPI v2](https://pokeapi.co/), sin backend. Está hecha con HTML, CSS y JavaScript puro (módulos ES), sin frameworks ni paso de compilación, y tiene la estética de las consolas clásicas: Game Boy DMG-01 y los juegos de primera generación.

Los datos se piden directamente desde el navegador a `https://pokeapi.co/api/v2`, así que el sitio puede publicarse tal cual en GitHub Pages.

## Secciones

| Página             | Contenido                                                       |
| ------------------ | --------------------------------------------------------------- |
| `index.html`       | Pokédex: rejilla de Pokémon con sprite, tipos y ficha detallada |
| `movimientos.html` | Movimientos con potencia, precisión, PP y efecto                |
| `tipos.html`       | Tabla de efectividad de tipos                                   |
| `habilidades.html` | Habilidades y su efecto                                         |
| `naturalezas.html` | Naturalezas agrupadas por estadística afectada                  |
| `objetos.html`     | Objetos con categoría, precio y efecto                          |
| `bayas.html`       | Bayas con crecimiento, firmeza y sabores                        |

Todas las secciones tienen buscador por nombre y, salvo Tipos y Naturalezas, paginación. La búsqueda y la página van en la URL (`?q=char&page=2`).

## Rendimiento

- **Caché de listas**: las listas completas que usa la búsqueda (`limit=100000`) se guardan en `localStorage` 24 horas (`pokedex:lista:<url>`), así que buscar de nuevo no vuelve a descargarlas.
- **Caché de detalles**: el resto de respuestas se guarda en memoria y en `sessionStorage` (`pokedex:detalle:<url>`) durante la sesión del navegador, también tras recargar.
- Si el almacenamiento no está disponible o está lleno, la web sigue funcionando sin caché.
- Como máximo se piden **6 detalles a la vez**. Si alguno falla, la sección se pinta con los que sí cargaron y un aviso del tipo `2 ELEMENTOS NO SE PUDIERON CARGAR`.
- Las imágenes generadas llevan `width`, `height`, `loading="lazy"` y `decoding="async"`.

## Seguridad

Cada página declara una `Content-Security-Policy` en una etiqueta `<meta>` (GitHub Pages no permite cabeceras HTTP) sin `'unsafe-inline'` ni `'unsafe-eval'`: scripts, estilos y fuentes solo del propio sitio, imágenes del propio sitio y de `raw.githubusercontent.com` y datos solo de `pokeapi.co`.

Por eso no se admiten estilos, scripts ni manejadores de eventos en línea (`style=`, `<script>` sin `src`, `on*=`), ni en los HTML ni en el HTML que genera la interfaz; un test lo comprueba. La anchura de las barras de estadísticas va en `data-valor` y se aplica con la propiedad CSS `--ancho` desde JavaScript, y los colores del acordeón de naturalezas son clases `acc-stat-*`.

Las fuentes Press Start 2P y VT323 se sirven desde `site/fonts/` en `woff2` (copiadas de `@fontsource` 5.3.0), con su licencia SIL Open Font License 1.1 en `site/fonts/OFL.txt`; no se usa Google Fonts.

## Accesibilidad

- Cada página de sección empieza con un enlace **Saltar al contenido**, visible al recibir el foco con Tab, que lleva el foco al contenido principal (`<main id="contenido">`).
- Los mensajes de carga, sin resultados, error y elementos no cargados se anuncian en una única región de estado (`role="status"`, `aria-live="polite"`) que no se recrea entre pintados.
- Sin JavaScript se muestra el aviso `ESTA POKÉDEX NECESITA JAVASCRIPT`.
- Con `prefers-reduced-motion: reduce` se desactivan todas las transiciones y animaciones.
- Los botones de tema e información anuncian si su panel está abierto (`aria-expanded`) y qué panel controlan (`aria-controls`). Se abren con Enter o Espacio; abrir uno cierra el otro, Escape cierra el abierto devolviendo el foco a su botón y un clic fuera los cierra todos.
- El menú de navegación se abre con un botón (`aria-expanded`, `aria-controls="nav-menu"`) operable con Enter o Espacio; Escape lo cierra y devuelve el foco al botón.
- El detalle de cada Pokémon es un `<dialog>` modal nativo: se abre con Enter o clic en la tarjeta, lleva el foco al botón cerrar y se cierra con Escape, con el botón o con un clic fuera del panel, devolviendo el foco a la tarjeta. Abrirlo pone `#pokemon-<id>` en la URL sin añadir entradas al historial, así que un enlace como `index.html?page=2#pokemon-25` abre directamente ese detalle si el Pokémon está en la página.
- El texto cumple el contraste WCAG 2.1 AA (4,5:1, o 3:1 en texto grande) en los tres temas; el smoke e2e audita con axe cada página en cada tema, y la Pokédex con el detalle abierto, y falla ante cualquier violación grave o crítica. En DMG el texto normal solo usa el verde más oscuro sobre los claros o al revés.

## Temas

Desde el botón de tema se elige entre **NORMAL** (rojo clásico), **DMG** (verde LCD de la Game Boy) y **MONO** (escala de grises). La elección se guarda en `localStorage` solo cuando se elige una opción. Sin tema guardado, el inicial sigue al sistema: **MONO** si prefiere esquema oscuro (`prefers-color-scheme: dark`) y **NORMAL** en otro caso; mientras no se elija ninguno, un cambio de preferencia del sistema se aplica en la siguiente carga.

## Uso en local

```bash
python3 -m http.server -d site
```

Abre `http://localhost:8000/`. La página 404 usa rutas absolutas `/Pokedex-Retro/…`, así que solo se ve bien servida bajo esa ruta, como en Pages. Cualquier servidor estático sirve; abrir los HTML con `file://` no funciona porque los módulos ES necesitan HTTP.

## Tests

Requiere Node ≥ 22. Los tests usan el runner nativo de Node y respuestas de PokéAPI simuladas, así que no necesitan red ni dependencias:

```bash
npm test
```

`npm test` incluye también los tests de `scripts/`. Para comprobar que la cabecera y la navegación de las siete páginas coinciden (la propia página se marca con `aria-current="page"`):

```bash
npm run check:html
```

Tests de mutación con Stryker sobre `site/js/core` y `site/js/mappers`:

```bash
npm install
npm run test:mutation
```

Y sobre la capa de interfaz `site/js/ui` (sin el arranque `main.js` ni `theme.js`), con umbral del 85 %, en dos ejecuciones de hasta 180 s: primero las vistas `render-*.js` (`stryker.ui-render.config.json`) y después el resto (`stryker.ui.config.json`):

```bash
npm run test:mutation:ui
```

Smoke e2e en Chromium con Playwright: sirve `site/` con `scripts/serve-site.mjs` y simula todas las peticiones a PokéAPI y a los sprites con los fixtures, así que no usa la red; falla si la página pide algo externo sin simular o si hay violaciones de la CSP:

```bash
npx playwright install chromium
npm run e2e
```

Presupuestos de Lighthouse (móvil, throttling simulado) sobre `index.html` y `tipos.html`, tres ejecuciones por página y mínimo 0,95 en rendimiento, accesibilidad, buenas prácticas y SEO. A diferencia del e2e, usa la PokéAPI real, así que necesita red; los informes quedan en `reports/lhci/`. La auditoría `robots-txt` se omite: la CSP de las páginas (`connect-src https://pokeapi.co`) impide a Lighthouse descargar `/robots.txt`, y en Pages ese fichero tendría que estar en la raíz del dominio, fuera de este repositorio:

```bash
npm run lhci
```

Para servir la web en local sin Python: `node scripts/serve-site.mjs` (puerto `4173`, o el de `PORT`).

## Estructura

```
site/
├── *.html              siete páginas y 404.html (rutas absolutas /Pokedex-Retro/)
├── css/pokedex.css     estilos y temas
├── fonts/              fuentes woff2 autoalojadas y su licencia OFL
├── images/             logotipo e iconos del manifiesto (192 y 512 px)
├── manifest.webmanifest
├── robots.txt
├── sitemap.xml         las siete páginas, sin la 404
└── js/
    ├── api/client.js   cliente HTTP: reintentos, timeout, cancelación y caché inyectable
    ├── api/cache.js    cachés de listas (localStorage, 24 h) y de detalles (sesión)
    ├── core/           lógica pura: URL, búsqueda, paginación, carga de secciones y límite de peticiones
    ├── mappers/        PokéAPI → datos de vista (con fixtures de respuestas reales)
    ├── ui/             renderizado en el DOM, selector de tema y cancelación al salir
    │   └── strings.js  textos de la interfaz, centralizados
    └── version.js      versión mostrada en el panel INFO (generado)
scripts/
├── check-html.mjs      comprueba que las cabeceras de las páginas coinciden
└── sync-version.mjs    genera site/js/version.js desde package.json
```

## Versión

La versión vive en `package.json` y se copia a `site/js/version.js`, que muestra el panel INFO. Para cambiarla se usa `npm version` (por ejemplo `npm version patch`), que regenera y añade `version.js` antes de su commit; un test falla si ambos valores no coinciden.

## Despliegue en GitHub Pages

El workflow `.github/workflows/pages.yml` ejecuta `npm test` y, si pasa, publica la carpeta `site/` en cada push a `main` (también se puede lanzar a mano).

Para activarlo una sola vez: **Settings → Pages → Build and deployment → Source: GitHub Actions**. El sitio queda en:

https://renzoramosdev.github.io/Pokedex-Retro/

Pages sirve `404.html` en cualquier ruta inexistente. `robots.txt` y `sitemap.xml` se publican con el sitio, aunque los rastreadores solo leen `robots.txt` en la raíz del dominio: en un sitio de proyecto el sitemap puede enviarse a mano.
