# Propuesta: Fase 4 — accesibilidad y tests de UI

## Why

El detalle de Pokémon es un `div` abierto por `:target` sin gestión de foco ni Escape; los botones de tema e información no anuncian su estado; el menú móvil es un checkbox con `aria-hidden="true"` inoperable por teclado; no hay skip-link, `<noscript>` ni región viva para los mensajes; las transiciones ignoran `prefers-reduced-motion` y el contraste del tema DMG no está verificado (texto `#306230` sobre `#9bbc0f` ≈ 3,3:1). Además, los renderizadores apenas tienen tests (mutación: `render-pokedex` 55 %, `render-items` 58 %, `render-natures` 24 %) y no existe ninguna prueba en navegador. Con la CSP estricta de la fase 3 ya en su sitio, esta fase lleva la web a WCAG 2.1 AA y blinda la capa `ui` con tests unitarios, e2e y Lighthouse.

## What Changes

- Detalle de Pokémon con `<dialog>` nativo abierto con `showModal()` y `aria-labelledby` al nombre; al abrir, foco en el botón cerrar; al cerrar (botón, Escape o clic en el fondo), foco de vuelta a la tarjeta. Enlace profundo: abrir pone `#pokemon-<id>` con `history.replaceState`, cargar con ese hash abre el diálogo y cerrar quita el hash. Sin `:target`, sin estilos ni manejadores en línea (CSP de la fase 3).
- Skip-link `Saltar al contenido` como primer elemento de cada página de sección, a `<main id="contenido" tabindex="-1">`, visible al recibir foco.
- Botones de tema e información con `aria-expanded`, `aria-controls` y `aria-haspopup="true"`; Escape cierra el desplegable abierto y devuelve el foco a su botón.
- Menú móvil: el checkbox oculto se sustituye por un `<button>` con `aria-expanded` y `aria-controls`; el aspecto (hamburguesa → X, menú desplegado) se conserva vía CSS sobre `aria-expanded`.
- Mensajes de carga, vacío, error y fallos parciales en una región persistente `role="status" aria-live="polite"`; `<noscript>` con `ESTA POKÉDEX NECESITA JAVASCRIPT`.
- `prefers-reduced-motion: reduce` desactiva transiciones y animaciones. Sin tema guardado, el inicial es `gray` con `prefers-color-scheme: dark` y `normal` en otro caso; el tema inicial no se persiste hasta que el usuario elige uno.
- Contraste AA (4,5:1; 3:1 en texto grande) en los temas `normal`, `gb` y `gray`, ajustando colores dentro de cada paleta (verde en `gb`).
- Nombre accesible del campo y del botón de búsqueda y de las zonas con desplazamiento horizontal (tabla de tipos y de objetos).
- Tests `node:test` de `layout.js` y de cada `render-*.js` (escapado, ARIA, estructura, uso de `strings.js`) y de los nuevos módulos de diálogo y desplegables; nueva config de Stryker para `site/js/ui` (sin `main.js` ni `theme.js`) con `thresholds.break: 85` y `npm run test:mutation:ui` (≤ 180 s).
- Playwright (`@playwright/test`, solo Chromium) con `@axe-core/playwright`: `tests/e2e/smoke.spec.js` sobre un servidor estático local y PokéAPI simulada con `page.route` a partir de los fixtures; `npm run e2e`.
- Lighthouse CI (`@lhci/cli`, `lighthouserc.json`) sobre `index.html` y `tipos.html`, 3 ejecuciones, `minScore: 0.95` en las cuatro categorías; `npm run lhci`.
- CI: en Node 24, mutación de `ui` y e2e en cada ejecución; Lighthouse solo en `pull_request`.

Fuera de alcance: traducción a otros idiomas; navegadores distintos de Chromium en e2e; `og:image` absoluta y precio de objetos (observaciones previas); la página `404.html` no recibe skip-link ni `<noscript>` (sin navegación ni JavaScript).

## Capabilities

### New Capabilities

- `accesibilidad-web`: comportamiento accesible de las páginas: diálogo de detalle, skip-link, desplegables y menú anunciados y operables por teclado, región de estado, `<noscript>`, movimiento reducido y contraste AA en los tres temas.

### Modified Capabilities

- `interfaz-web`: `initTheme` deja de conectar los desplegables (pasan a un módulo propio) y elige el tema inicial según `prefers-color-scheme` sin persistirlo; el aviso de elementos no cargados se muestra en la región de estado.
- `calidad-codigo`: tests de UI en Node, mutación de `ui` ≥ 85 % en config separada, e2e con axe y Lighthouse CI; el cierre de fase exige ≥ 387 tests, `test:mutation:ui`, `e2e` y `lhci`.
- `integracion-continua`: el CI ejecuta mutación de `ui` y e2e en Node 24 y Lighthouse CI en `pull_request` (Node 24).

## Impact

- **Ficheros nuevos**: `site/js/ui/dialog.js`, `site/js/ui/disclosure.js` y sus tests; `site/js/ui/render-{pokedex,moves,natures,items,berries,types,abilities}.test.js`; `site/js/pages-a11y.test.js`; `scripts/serve-site.mjs` (+ test); `tests/e2e/smoke.spec.js`, `tests/e2e/pokeapi-mock.js`; `playwright.config.js`; `stryker.ui.config.json`; `lighthouserc.json`.
- **Ficheros modificados**: `site/*.html` (7: skip-link, `main#contenido`, región de estado, `<noscript>`, botón de menú, ARIA de los desplegables), `site/css/pokedex.css` (diálogo, skip-link, menú, movimiento reducido, contraste), `site/js/ui/{main,theme,layout,strings,render-pokedex,render-types,render-items}.js` (+ tests), `site/js/ui/theme.test.js`, `site/js/ui/layout.test.js`, `package.json`, `package-lock.json`, `eslint.config.js`, `.gitignore`, `.prettierignore`, `.github/workflows/ci.yml`, `README.md`, `CONTRIBUTING.md`.
- **Contrato de `ui`**: `initTheme(document, storage, prefersDark)`; `layout.js` sustituye `sectionContent`/`failedNotice`/`statusMessage` por `statusText(result)` y `sectionBody(view, result)`. `core` y `mappers` no cambian.
- **Dependencias de desarrollo nuevas**: `@playwright/test`, `@axe-core/playwright`, `@lhci/cli` (previstas en el plan). Sin dependencias en runtime.
