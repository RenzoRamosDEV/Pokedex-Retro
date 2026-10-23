# Propuesta: Fase 3 — rendimiento y seguridad

## Why

Cada búsqueda vuelve a descargar listas de hasta ~1.300 entradas (`limit=100000`), los detalles de una página se piden todos a la vez sin límite y sus fallos se silencian, las fuentes dependen de Google Fonts (privacidad, latencia) y ninguna página tiene CSP; además la UI genera atributos `style=`, incompatibles con una CSP sin `'unsafe-inline'`. La fase 2 dejó preparado el puerto `cache` del cliente HTTP y los textos centralizados, así que ahora se puede reducir la carga sobre PokéAPI y endurecer la web publicada en GitHub Pages sin tocar la arquitectura.

## What Changes

- Caché de listas completas (URLs con `limit=100000`) en `localStorage`, clave `pokedex:lista:<url>`, valor `{ "t": <epoch ms>, "data": <json> }`, válida si `ahora - t < 86 400 000` ms (ADR 0002). Entradas caducadas o corruptas se ignoran y se sobrescriben.
- Caché de cualquier otra URL en un `Map` en memoria y en `sessionStorage` (`pokedex:detalle:<url>`), sin caducidad.
- Ambas cachés toleran almacenamiento ausente o que lanza (modo privado, `QuotaExceededError`, JSON inválido): se sigue sin caché y sin error visible. Se inyectan en `createFetchJson` desde `main.js`.
- Nuevo `site/js/core/limit.js` (puro): como máximo 6 peticiones de detalle en vuelo; `loadSection` usa `Promise.allSettled` y devuelve además el número de detalles fallidos.
- Aviso `role="status"` con `N ELEMENTOS NO SE PUDIERON CARGAR` (`1 ELEMENTO NO SE PUDO CARGAR` si N = 1), textos en `strings.js`; la sección se pinta con los elementos que sí cargaron.
- Fuentes Press Start 2P y VT323 (SIL OFL 1.1) autoalojadas en `site/fonts/*.woff2` con `site/fonts/OFL.txt`, `@font-face` con `font-display: swap` y `<link rel="preload" as="font" type="font/woff2" crossorigin>`; se eliminan los enlaces a `fonts.googleapis.com` / `fonts.gstatic.com`.
- Todo `<img>` generado por la UI lleva `width`, `height`, `loading="lazy"` y `decoding="async"`; una imagen de logotipo sobre la línea de flotación no lleva `loading="lazy"`.
- `<meta http-equiv="Content-Security-Policy">` en cada HTML con el texto exacto `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' https://raw.githubusercontent.com; connect-src https://pokeapi.co; manifest-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`, sin `'unsafe-inline'`.
- Sin atributos `style` en el HTML generado: barras de estadísticas con `data-valor="<0-100>"` y `--ancho` aplicado vía CSSOM; colores del acordeón de naturalezas como clases `acc-stat-<estadistica>` en `pokedex.css`. Un test recorre los HTML y la salida de los `render-*` y falla ante `style=`, `<script>` en línea u `on*=`.
- Nuevos `site/404.html` (estética retro, `ERROR 404`, enlace al inicio, rutas absolutas `/Pokedex-Retro/...`), `site/robots.txt`, `site/sitemap.xml` (7 páginas) y `site/manifest.webmanifest` con iconos PNG de 192 y 512 px generados del logotipo y enlazado desde cada HTML.
- `check:html` excluye `404.html` de la comparación de cabeceras.

Fuera de alcance: service worker / modo offline, PWA instalable más allá del manifest, cabeceras HTTP (Pages no permite configurarlas), accesibilidad del modal y tests de UI completos (fase 4).

## Capabilities

### New Capabilities

- `seguridad-web`: política de seguridad de contenidos de las páginas, prohibición de estilos, scripts y manejadores en línea, y recursos (fuentes incluidas) servidos solo desde orígenes autorizados.
- `publicacion-web`: ficheros de publicación del sitio en Pages: página 404, `robots.txt`, `sitemap.xml` y manifiesto web con iconos.

### Modified Capabilities

- `cliente-http`: se añaden la caché persistente de listas (24 h), la de detalles (memoria + sesión) y su tolerancia a fallos de almacenamiento.
- `interfaz-web`: se añaden el límite de 6 detalles simultáneos, el aviso de elementos no cargados y los atributos de las imágenes generadas.
- `calidad-codigo`: `check:html` excluye `404.html`; el cierre de fase exige al menos 230 tests.

## Impact

- **Ficheros nuevos**: `site/js/api/cache.js`, `site/js/core/limit.js`, `site/js/ui/csp.test.js`, `site/js/site-files.test.js` y los tests de cada módulo nuevo (`site/js/api/cache.test.js`, `site/js/core/limit.test.js`, `site/js/ui/layout.test.js`); `site/fonts/{press-start-2p-latin-400-normal,vt323-latin-400-normal}.woff2`, `site/fonts/OFL.txt`; `site/404.html`, `site/robots.txt`, `site/sitemap.xml`, `site/manifest.webmanifest`, `site/images/icon-{192,512}.png`.
- **Ficheros modificados**: `site/js/core/load-section.js` (+ test), `site/js/mappers/nature.js` (+ test: sin `color`), `site/js/ui/{main,layout,strings,render-pokedex,render-natures,render-items}.js`, `site/css/pokedex.css`, `site/*.html` (7: CSP, preload, manifest, sin Google Fonts), `scripts/check-html.mjs` (+ test), `README.md`.
- **Contrato de `core`**: `loadSection` añade `failedCount` al resultado `ok`; el resto del contrato no cambia.
- **Dependencias**: ninguna nueva; `woff2` e iconos se versionan como ficheros.
