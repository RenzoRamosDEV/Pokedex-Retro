# Propuesta: Fase 2 — arquitectura de la web

## Why

La capa `ui` de la web no es testeable ni robusta: `theme.js` consulta el DOM y `localStorage` al importarse (y rompe si el almacenamiento lanza), el cliente HTTP es una función mínima dentro de `main.js` sin timeout, reintentos ni cancelación, y los textos visibles están dispersos y mezclan inglés (`HIDDEN`, `◀ PREV`, `NEXT ▶`) con español. Además nada garantiza que `site/js/core` y `site/js/mappers` sigan importándose desde Node, requisito para que el servidor MCP de la fase 5 los reutilice, ni que las 7 cabeceras HTML sigan siendo idénticas (ADR 0001). Esta fase lo corrige antes de añadir caché, CSP y accesibilidad (fases 3 y 4), que se apoyan en estos módulos.

## What Changes

- Nuevo `site/js/api/client.js` con la fábrica `createFetchJson({ fetch, cache, timeoutMs = 10000, retries = 2 })`: reintentos solo ante error de red, 429 y 5xx con espera `500 ms × 2^intento`; `AbortError` sin reintento al abortar; `TimeoutError` al superar el plazo; `fetch` inyectable y `cache` opcional (sin implementación persistente en esta fase).
- `main.js` usa ese cliente, crea un `AbortController` por carga, lo aborta en `pagehide` y no pinta el mensaje de error de una carga abortada.
- `theme.js` sin efectos al importarse: exporta `initTheme(document, storage)`, que `main.js` invoca; funciona sin persistir si el almacenamiento falla. Comportamiento visible idéntico (clave `theme`, valores `normal`/`gb`/`gray`, por defecto `normal`).
- Nuevo `site/js/ui/strings.js`: objeto congelado con todos los textos de UI generados desde JS; `render-*.js`, `layout.js` y `main.js` dejan de contener literales visibles.
- Cambios de texto visibles: `HIDDEN` → `OCULTA`, `◀ PREV` → `◀ ANT.`, `NEXT ▶` → `SIG. ▶`. El resto de textos no cambia.
- El enlace de la página actual lleva `aria-current="page"` además de la clase `active` en los 7 HTML.
- Nuevo `scripts/check-html.mjs` (sin dependencias) y `npm run check:html`: compara la cabecera de las 7 páginas y falla con código 1 indicando el fichero divergente; se ejecuta en `ci.yml`.
- Nuevo `site/js/version.js` (`VERSION`, igual a `version` de `package.json`) generado por `scripts/sync-version.mjs`; un test falla si no coinciden. El panel INFO muestra `VERSION` desde JS y desaparece la cadena `1.0` fija de los HTML. `package.json` pasa a declarar `"version": "1.0.0"`.
- Nuevo `site/js/purity.test.js`: importa todos los módulos de `core` y `mappers` en Node sin `window` ni `document`.
- La meta `description` de los 7 HTML deja de mencionar "cadenas evolutivas".
- `npm test` incluye los tests de `scripts/`; el typecheck cubre también `site/js/api`.

Fuera de alcance: caché persistente, límite de concurrencia, CSP, fuentes propias, accesibilidad del modal (fases 3 y 4) y cualquier cambio visual distinto de los tres textos anteriores.

## Capabilities

### New Capabilities

- `cliente-http`: obtención de JSON de PokéAPI con reintentos acotados, timeout, cancelación y caché inyectable.
- `interfaz-web`: comportamiento observable de las páginas: carga cancelable al salir, tema persistente tolerante a fallos de almacenamiento, textos en español centralizados, versión visible, marca de página activa y metadatos.

### Modified Capabilities

- `calidad-codigo`: el typecheck cubre `site/js/api`; se añaden la comprobación de cabeceras (`check:html`), la pureza de `core`/`mappers` y la coherencia de versión; el cierre de fase incluye `check:html` y un mínimo de 135 tests.
- `integracion-continua`: el workflow `CI` ejecuta también `npm run check:html`.
- `gobierno-repositorio`: la plantilla de PR añade `npm run check:html` a la checklist.

## Impact

- **Ficheros nuevos**: `site/js/api/client.js`, `site/js/ui/strings.js`, `site/js/ui/cancelable-load.js`, `site/js/version.js`, `scripts/check-html.mjs`, `scripts/sync-version.mjs` y sus tests (`site/js/api/client.test.js`, `site/js/ui/{theme,strings,cancelable-load}.test.js`, `site/js/version.test.js`, `site/js/purity.test.js`, `scripts/{check-html,sync-version}.test.mjs`).
- **Ficheros modificados**: `site/js/ui/{main,theme,layout}.js`, `site/js/ui/render-*.js` (7), `site/*.html` (7: `aria-current`, versión, meta `description`), `package.json` (`version`, scripts `test`, `check:html`, `version`), `tsconfig.json` (`include` de `site/js/api`), `stryker.config.json` (comando de tests), `.github/workflows/ci.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`, `README.md`.
- **Sin cambios**: `site/js/core`, `site/js/mappers` (contrato `loadSection(fetchJson, config, parsedQuery)` intacto), `site/css/pokedex.css`, `pages.yml`.
- **Dependencias**: ninguna nueva (ni de desarrollo ni de runtime).
