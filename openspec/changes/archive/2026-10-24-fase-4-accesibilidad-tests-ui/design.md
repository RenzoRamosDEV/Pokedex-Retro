# Diseño: Fase 4 — accesibilidad y tests de UI

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: ver `specs/`.

Estado observado en `main` (fase 3 fusionada, `2f860df`):

- `site/js/ui/main.js` arranca al importarse: pinta `pageHeader + statusMessage(CARGANDO)` con `main.innerHTML`, carga con `loadSection` y vuelve a pintar `header + sectionContent(view, result)`; luego `applyStatBarWidths(main)`. Llama a `initTheme(document, storageOrNull('localStorage'))`.
- `site/js/ui/theme.js`: `initTheme` aplica el tema (guardado o `normal`) **y lo guarda siempre**, y conecta los botones `#theme-btn`/`#info-btn` (alternan `hidden` de `#theme-dropdown`/`#info-dropdown`, `stopPropagation`, clic en el documento cierra ambos). Sin `aria-expanded` ni Escape. `theme.test.js` usa un documento falso.
- `site/js/ui/layout.js`: `pageHeader` (campo de búsqueda solo con `placeholder`, botón `▶` sin nombre), `statusMessage`, `paginationNav`, `upper`, `failedNotice` (`<p role="status">` recreado en cada pintado), `sectionContent`, `applyStatBarWidths`.
- `render-pokedex.js`: tarjeta `<a href="#pokemon-<id>" class="card-link" aria-label="Ver detalles de …">`; detalle = `div.modal role="dialog" aria-modal aria-label` con `modal-backdrop`/`modal-close-area` y `a.modal-close`, abierto por `.modal:target` en `pokedex.css` (más variantes de tema en `body[data-theme='gb'|'gray'] .modal-backdrop`).
- Cabecera (idéntica en los 7 HTML, vigilada por `check:html`): `<input type="checkbox" id="nav-toggle" aria-hidden="true">` + `<label class="hamburger">`; CSS `.nav-toggle:checked ~ …` despliega `.nav-menu` (oculta en todos los anchos) y anima la X. `<main class="site-main"><p class="page-info">CARGANDO...</p></main>`; sin skip-link ni `<noscript>`.
- CSP de la fase 3 en cada HTML: `script-src 'self'; style-src 'self'` sin `'unsafe-inline'`; `csp.test.js` prohíbe `style=`, `<script>` en línea y `on*=` en HTML y en la salida de las vistas.
- Contraste medido con la fórmula WCAG: tema `gb` `#306230` sobre `#9bbc0f` = 3,29:1 y sobre `#8bac0f` = 2,75:1 (fallan en texto normal); `#0f380f` sobre `#9bbc0f` = 6,02:1 y sobre `#8bac0f` = 5,03:1. Insignias de tipo (texto `#f5f0e8`, 8 px) en todos los temas: `normal #787858` 4,00, `electric #a89000` 2,78, `grass #408030` 4,26, `ice #6090a0` 3,09, `ground #887830` 3,88.
- `.matrix-scroll` (tabla de tipos) y `.shop-wrap` (objetos) tienen `overflow-x: auto` sin elementos enfocables dentro (regla axe `scrollable-region-focusable`, impacto `serious`).
- `transition` en tarjetas, botones, barras, menú y hamburguesa; ninguna regla `prefers-reduced-motion`.
- El tema `gray` (MONO) es claro (`#d0d0d0`) y `normal` es oscuro (`#1a2e1a`); aun así el tema inicial con esquema oscuro es `gray` por decisión del plan (sección 5).
- Tests: 387 en verde. Mutación medida en fase 3: `render-pokedex` 55 %, `render-items` 58 %, `render-natures` 24 %. `strings.test.js` incluye la guarda `"<fichero> has no visible text literals"`, que lee el código fuente y falla con el código instrumentado por Stryker (en la fase 3 se excluyó con `--test-skip-pattern`).
- Fixtures: un JSON por recurso (`pokemon.json` = gengar #94, `move.json` thunderbolt #85, `nature.json` adamant #11, `item.json` master-ball #1, `berry.json` cheri #1, `type.json` ghost #8, `ability.json` stench #1). `loadSection` pide listas `…/<recurso>?limit=<n>[&offset=<m>]` y detalles `…/<recurso>/<nombre>`; tamaños de página: pokemon 18, move 16, item 12, berry 15, ability 8; nature y type sin paginar (`limit=100`, type excluye `unknown` y `shadow`).
- Herramientas locales: Node 24, Google Chrome en `/usr/bin/google-chrome`, Python 3.

## Goals / Non-Goals

**Goals:**

- Toda la lógica nueva de la UI vive en módulos importables en Node, con DOM inyectado y tests con fakes; `main.js` solo cablea.
- Cada escenario de `specs/accesibilidad-web` tiene un test unitario o e2e; los e2e no usan red.
- Cero dependencias en runtime; solo las tres de desarrollo previstas en el plan.
- La CSP no se relaja: ningún cambio introduce estilos, scripts ni manejadores en línea.

**Non-Goals:**

- Auditoría manual con lector de pantalla, navegadores distintos de Chromium, otros idiomas.
- Rediseño visual: solo cambian los colores que no cumplen AA y el marcado necesario.
- Accesibilidad de `404.html` más allá de lo que ya tiene (sin JavaScript ni navegación).

## Decisions

### D1. Diálogo nativo en `site/js/ui/dialog.js`

- Marcado (`render-pokedex.js`): `<dialog id="pokemon-<id>" class="modal" aria-labelledby="pokemon-<id>-nombre">` con `<div class="modal-panel">`, `<button type="button" class="modal-close" data-cerrar aria-label="${STRINGS.pokedex.cerrar}">✕</button>` y `<h2 id="pokemon-<id>-nombre" class="modal-name">`. Desaparecen `role="dialog"`, `aria-modal`, `aria-label`, `.modal-backdrop` y `.modal-close-area` (el `<dialog>` modal ya es modal, inerte fuera y con Escape nativo). La tarjeta sigue siendo `<a href="#pokemon-<id>" class="card-link">`: activable con Enter y degradable a ancla.
- Módulo `dialog.js` (sin efectos al importar):
  - `dialogIdFromHash(hash)` → `'pokemon-<n>'` si `hash` cumple `/^#pokemon-\d+$/`, si no `null`.
  - `connectPokemonDialogs({ root, document, location, history })` registra en `root` (el `<main>`, que persiste entre pintados) por delegación: clic en `a.card-link` → `preventDefault` y `open(id)`; clic en `[data-cerrar]` → `dialog.close()`; clic cuyo `target` es el propio `<dialog>` (zona del `::backdrop`, ya que el panel ocupa todo el contenido) → `dialog.close()`; evento `close` en **captura** (no burbujea) → foco a `a.card-link[href="#<id>"]` si existe y `history.replaceState(null, '', location.pathname + location.search)`. Devuelve `{ openFromHash() }`, que abre el diálogo de `dialogIdFromHash(location.hash)` si existe en el documento y no hace nada en otro caso.
  - `open(id)`: `dialog.showModal()`, `dialog.querySelector('[data-cerrar]').focus()` y `history.replaceState(null, '', '#' + id)`.
  - El retorno del foco se resuelve por id de tarjeta, sin guardar estado: funciona igual al abrir desde la tarjeta o por enlace profundo.
- `main.js`: crea el conector una vez sobre `main` y llama a `openFromHash()` tras cada pintado correcto.
- CSS: `.modal` sin `:target`; `.modal[open] { display: flex }` con `padding: 0`, `border: 0`, `background: transparent`, `max-width`/`max-height` relativos al viewport; `.modal::backdrop { background: rgba(13, 13, 13, 0.85) }` y las variantes de tema pasan de `.modal-backdrop` a `.modal::backdrop`. `.modal-close` se adapta a `<button>` (fuente, cursor, sin fondo por defecto).
- Tests (`dialog.test.js`) con fakes: elementos con `closest`, `getAttribute`, `focus` espía; diálogo falso con `showModal`/`close` que emite `close` al `root` en captura; `history.replaceState` espía; `location` con `pathname`, `search`, `hash`. Particiones: hash válido (`#pokemon-25`), inválidos (`''`, `#`, `#pokemon-`, `#pokemon-2a`, `#otra-25`, `#pokemon-25x`), hash válido sin diálogo en la página; clic en tarjeta, en cerrar, en el fondo y dentro del panel (no cierra); cierre por Escape simulado con `close`.
- Alternativas descartadas: atributo `closedby="any"` para el clic en el fondo (soporte parcial fuera de Chromium); `<form method="dialog">` (interacción con `form-action` de la CSP y sin ventaja); conservar `:target` y añadir JS de foco (sin inercia del resto de la página ni trampa de foco nativas).

### D2. Desplegables y menú en `site/js/ui/disclosure.js`

- Patrón «disclosure»: el estado vive en `panel.hidden` y se refleja en `aria-expanded` del botón. `connectDisclosures(document, pares)` con `pares = [{ button, panel }]` (ids):
  - Al conectar: `aria-expanded` = `String(!panel.hidden)`.
  - Clic en un botón: `stopPropagation`; alterna su panel y cierra los demás.
  - Clic en el documento: cierra todos; si el foco estaba dentro de un panel que se cierra, pasa a su botón (evita perder el foco al elegir un tema).
  - `keydown` `Escape` en el documento: cierra el panel abierto y enfoca su botón; sin panel abierto no hace nada.
- HTML (los 7, dentro de `<header>`): `#theme-btn` y `#info-btn` con `type="button"`, `aria-haspopup="true"`, `aria-expanded="false"` y `aria-controls`; el menú pasa a `<button type="button" id="nav-btn" class="hamburger" aria-label="Abrir menú" aria-expanded="false" aria-controls="nav-menu">` (los `<span>` con `aria-hidden="true"`) y `<nav id="nav-menu" class="nav-menu" aria-label="Navegación principal" hidden>`. Se elimina el checkbox `#nav-toggle`.
- CSS: `.nav-menu` pasa a `display: flex` y `.nav-menu[hidden] { display: none }`; la X usa `.hamburger[aria-expanded='true'] span:nth-child(n)`; `.hamburger` recibe el reset de botón (fondo, fuente). El aspecto no cambia.
- `theme.js`: `initTheme` deja de manejar los botones; solo aplica el tema y conecta las opciones. `main.js` llama a `connectDisclosures(document, [theme, info, nav])`.
- Sin JavaScript el menú no se abre: aceptado, el `<noscript>` ya indica que la web lo necesita.
- Tests (`disclosure.test.js`, fakes de documento y elementos con `hidden`, `setAttribute`, `contains`, `focus`): estado inicial, alternar, exclusión mutua, clic fuera, foco dentro de panel cerrado, Escape con y sin panel abierto, otras teclas ignoradas. Los tests de desplegables de `theme.test.js` se mueven aquí.
- Alternativas descartadas: mantener el checkbox con `role="button"` (`aria-expanded` no está permitido en `checkbox` y axe lo marca); clase en `<header>` como estado (dos fuentes de verdad frente a `aria-expanded`); `<details>`/`<summary>` (cambia el marcado y el aspecto de la cabecera).

### D3. Tema inicial

- `initTheme(document, storage, prefersDark = false)`: tema guardado si es uno de `normal|gb|gray`; si no, `gray` con `prefersDark` y `normal` sin él. El tema inicial **no se guarda**; solo una elección del usuario llama a `setItem`. Así un cambio de preferencia del sistema sigue aplicándose mientras el usuario no elija.
- `main.js` pasa `window.matchMedia('(prefers-color-scheme: dark)').matches`.
- Tests en `theme.test.js`: almacenamiento vacío con y sin `prefersDark`, guardado `normal` con `prefersDark` (prevalece), valor guardado desconocido → por preferencia, sin `setItem` al iniciar, `setItem` al elegir, almacenamiento que lanza.
- Alternativa descartada: escuchar cambios de `matchMedia` en caliente (no lo pide el requisito).

### D4. Región de estado, skip-link y `<noscript>`

- HTML de cada página de sección:
  ```html
  <body …>
    <a class="skip-link" href="#contenido">Saltar al contenido</a>
    <header class="site-header">…</header>
    <main id="contenido" class="site-main" tabindex="-1">
      <div data-cabecera></div>
      <noscript><p class="page-info">ESTA POKÉDEX NECESITA JAVASCRIPT</p></noscript>
      <p class="page-info estado" role="status" aria-live="polite" data-estado></p>
      <div data-contenido></div>
    </main>
  ```
  El skip-link queda fuera de `<header>`: `check:html` no cambia. La región empieza vacía (sin JavaScript solo se ve el `<noscript>`).
- `layout.js`: `statusText(result)` devuelve texto plano (error → `errorCarga`; sin elementos y sin fallos → `sinResultados`; fallos → aviso; correcto → `''`) y `sectionBody(view, result)` devuelve elementos + paginación + overlays (o `''`). Se eliminan `statusMessage`, `failedNotice` y `sectionContent` (sus tests se reescriben sobre las nuevas funciones con los mismos casos límite 0, 1, 2, 18).
- `main.js`: pinta la cabecera en `[data-cabecera]`, pone `CARGANDO...` con `textContent` en `[data-estado]` y, al terminar, `textContent = statusText(result)` e `innerHTML = sectionBody(…)` en `[data-contenido]`. La región no se recrea, así los lectores anuncian cada cambio.
- CSS: `.estado:empty { display: none }`; `.skip-link` fuera de pantalla y visible en `:focus` (amarillo sobre negro, contraste 13:1 en todos los temas).
- `404.html` no cambia: sin navegación que saltar ni JavaScript (coherente con su exclusión de `check:html`).
- Test estático `site/js/pages-a11y.test.js` sobre los 7 HTML: primer hijo de `<body>` = skip-link a `#contenido`; `<main id="contenido" tabindex="-1">`; exactamente una región `role="status" aria-live="polite"` dentro de `<main>`; `<noscript>` con el texto; botones de tema/info con `aria-haspopup="true"`, `aria-expanded="false"` y `aria-controls` que apunta a un id existente; botón de menú con `aria-expanded`, `aria-controls="nav-menu"` y nombre; sin `aria-hidden` en elementos enfocables; `pokedex.css` con el bloque de movimiento reducido (D5).

### D5. Movimiento reducido, contraste y nombres accesibles

- Al final de `pokedex.css`: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; } }`. Es el único `!important` nuevo: debe vencer a las reglas de tema más específicas.
- Contraste, regla para `gb`: texto normal solo con los pares `#0f380f` sobre `#9bbc0f`/`#8bac0f` o `#9bbc0f`/`#8bac0f` sobre `#0f380f`; `#306230` queda para bordes, decoración y texto grande (3,29:1 ≥ 3:1). Insignias de tipo (todos los temas): valores de partida que cumplen 4,5:1 con `#f5f0e8`, oscureciendo el mismo tono: `normal #6e6e51` (4,61), `electric #7c6b00` (4,67), `grass #3d7a2e` (4,60), `ice #4c727e` (4,61), `ground #7a6c2b` (4,62). Los valores finales los fija axe en e2e (D9); cada cambio se anota con su ratio para el PR.
- Nombres accesibles: `pageHeader` añade `aria-label="${STRINGS.comun.etiquetaBusqueda}"` al campo y `aria-label="${STRINGS.comun.enviarBusqueda}"` al botón `▶` (`'Buscar por nombre'`, `'Buscar'`); `.matrix-scroll` y `.shop-wrap` reciben `tabindex="0" role="region" aria-label` con `STRINGS.tipos.titulo` y `STRINGS.objetos.titulo`. Los textos nuevos cumplen la guarda de literales.
- Otras violaciones `serious`/`critical` que axe descubra se corrigen en la misma tarea con el cambio mínimo y se anotan para el PR.

### D6. Tests unitarios de la capa `ui`

- Un fichero por vista: `render-{pokedex,moves,natures,items,berries,types,abilities}.test.js`, más `layout.test.js` ampliado. Datos: fixture mapeado por `SECTIONS[<sección>].mapper` y variantes con `{ ...item, id, name }`.
- Casos por vista (requisito «Tests de la capa de interfaz»): escapado (`name`/efecto con `<script>alert(1)</script>` → `&lt;script&gt;` y ningún `<script`), estructura (N elementos → N tarjetas/filas; en Pokédex N diálogos con ids únicos y `aria-labelledby` que apunta a un id existente), clases derivadas de datos (`type-<tipo>`, `damage-class`, `flavor-<sabor>`, `eff-<x>-cell`, `acc-stat-<estadística>`), ramas de datos ausentes (`sprite: null`, `cost: null`, `shortEffect: null`, `power: null`, sin sabores, sin naturalezas neutras, habilidad oculta) y textos tomados de `STRINGS` (fragmentos exactos esperados escritos como literales: «casos dorados» por fragmento, sin ficheros dorados completos).
- `layout.test.js`: `pageHeader` (con y sin búsqueda, valor escapado, nombres accesibles), `paginationNav` (primera, intermedia, última, única: enlaces y `disabled`), `statusText` y `sectionBody` (límites 0, 1, 2, 18 fallos; error; vacío), `upper`.
- Sin DOM real: las vistas son funciones de cadena. Cada fichero termina en < 2 s.
- Alternativa descartada: ficheros dorados con el HTML completo por vista (cualquier cambio de marcado de esta fase los reescribe; los fragmentos exactos dan la misma capacidad de matar mutantes con menos fricción).

### D7. Mutación de `ui`: `stryker.ui.config.json`

- Config separada desde el principio (la principal se mantiene intacta y bajo 180 s; sumar `ui` arriesga el presupuesto):
  ```json
  {
    "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
    "testRunner": "command",
    "commandRunner": {
      "command": "node --test --test-skip-pattern=\"has no visible text literals\" \"site/js/ui/**/*.test.js\""
    },
    "mutate": ["site/js/ui/**/*.js", "!site/js/ui/**/*.test.js", "!site/js/ui/main.js", "!site/js/ui/theme.js"],
    "ignorePatterns": ["tsconfig.json"],
    "thresholds": { "high": 90, "low": 85, "break": 85 },
    "reporters": ["clear-text", "progress"],
    "timeoutMS": 10000
  }
  ```
- Script `"test:mutation:ui": "timeout 180 stryker run stryker.ui.config.json"`. `test:mutation` no cambia.
- La guarda de literales se salta solo dentro de Stryker (lee el fuente instrumentado); sigue en `npm test` y en CI.
- `theme.js`: se excluye como pide el plan (toca `document.body` y el almacenamiento real). Como cambia en esta fase, se le aplica la mutación del diff (regla TDD > 95 %), igual que en la fase 2 (100 %). `main.js` solo cablea y se cubre con e2e.
- Si la ejecución supera 180 s, se divide en `stryker.ui-render.config.json` (`render-*.js`) y `stryker.ui.config.json` (resto), cada una con su script y su `timeout 180` (regla común 5).

### D8. Servidor estático `scripts/serve-site.mjs`

- `node:http` + `node:fs`, sin dependencias: sirve `site/` en `http://127.0.0.1:<PORT>` (`PORT` por defecto `4173`), `/` → `index.html`, tipos MIME de `.html`, `.js`, `.css`, `.json`, `.webmanifest`, `.png`, `.woff2`, `.txt`, `.xml`; 404 si no existe; rechaza rutas que salen de `site/` (`..`, codificadas) con 404.
- Funciones puras exportadas (`contentTypeFor`, `resolveInside(root, url)`) con test en `scripts/serve-site.test.mjs` (entra en `npm test`) más un test de humo que arranca el servidor en un puerto efímero y pide `index.html`, un `.js` y una ruta con `..`.
- Alternativas descartadas: `python3 -m http.server` (dependencia oculta del sistema, MIME de `.js` variable entre versiones); `http-server`/`serve` (dependencias fuera del plan).

### D9. Playwright con PokéAPI simulada

- `playwright.config.js`: `testDir: 'tests/e2e'`, un proyecto `chromium` (`devices['Desktop Chrome']`), `webServer: { command: 'node scripts/serve-site.mjs', url: 'http://127.0.0.1:4173/index.html', reuseExistingServer: !process.env.CI }`, `use.baseURL`, `retries: 0` (datos deterministas), `reporter: 'list'`, `globalTimeout: 180_000` (aborta un smoke colgado). Script `"e2e": "playwright test"`.
- `tests/e2e/pokeapi-mock.js` (helper, no spec):
  - Catálogo sintético por recurso a partir del fixture: `pokemon` 40 entradas (ids 1–40, nombre `pokemon-<id>` salvo `25 → pikachu`), `move` 20, `item` 15, `berry` 20, `ability` 10 (todas ≥ 2 páginas), `nature` 25, `type` los 18 nombres reales + `unknown` y `shadow`. Nombre genérico `<nombre-del-fixture>-<id>`.
  - `page.route('https://pokeapi.co/api/v2/**')`: si la ruta es `/<recurso>` → lista `{ count, next: null, previous: null, results: catálogo.slice(offset, offset + limit).map(({ id, name }) => ({ name, url: \`https://pokeapi.co/api/v2/<recurso>/<id>/\` })) }` leyendo `limit` (por defecto 20) y `offset` (0); si es `/<recurso>/<nombre>` → `{ ...structuredClone(fixture), id, name }` del catálogo, o 404 si no existe.
  - `page.route('https://raw.githubusercontent.com/**')` → `site/images/icon-192.png` (`image/png`).
  - Registro de peticiones a orígenes distintos del servidor local no atendidas por las rutas y de mensajes de consola con `Content Security Policy`; un `afterEach` exige que ambos estén vacíos.
  - Con 18 tipos reales, la tabla de tipos pinta las insignias de todos los tipos y axe comprueba su contraste en cada tema.
- `tests/e2e/smoke.spec.js` (único spec):
  - Carga de las 7 páginas: título, ≥ 1 elemento y región de estado vacía.
  - Búsqueda `pika` → URL `?q=pika`, una tarjeta `#25`. Paginación: `SIG. ▶` → `?page=2`, primera tarjeta `#19`, `2 / 3`.
  - Diálogo: escenarios «Modal con teclado», «Cierre con el botón», «Clic en el fondo» (clic en una esquina del viewport), «Enlace profundo» (`index.html?page=2#pokemon-25`), «Hash al abrir y cerrar» (incluye `history.length` constante), «Pokémon fuera de la página» y nombre accesible (`getByRole('dialog', { name: 'PIKACHU' })`).
  - Skip-link (primer Tab, Enter → foco en `#contenido`); desplegables y menú con teclado (Enter, Escape, foco, `aria-expanded`); elegir `DMG` con teclado y recargar → `gb`; `emulateMedia({ colorScheme: 'dark' })` sin almacenamiento → `gray`; `emulateMedia({ reducedMotion: 'reduce' })` → `transitionDuration` `0s` en `.poke-card`, `.page-btn` y `.stat-bar-fill`.
  - axe: por cada página × tema (`addInitScript` que escribe `theme` en `localStorage`), y en la Pokédex con el diálogo abierto en cada tema, `new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()`; falla si hay violaciones `serious` o `critical`, con mensaje `<página> [<tema>]: <regla> → <selectores>`.
- TDD en e2e: cada caso nuevo se escribe y se ve fallar contra el comportamiento actual antes de implementar la tarea que lo satisface; los casos de comportamiento ya existente (carga, búsqueda, paginación, persistencia) entran en verde con la infraestructura.
- Navegador: `npx playwright install chromium` en local; en CI `npx playwright install --with-deps chromium` solo en Node 24.

### D10. Lighthouse CI contra PokéAPI real

- `lighthouserc.json`:
  ```json
  {
    "ci": {
      "collect": {
        "staticDistDir": "./site",
        "url": ["http://localhost/index.html", "http://localhost/tipos.html"],
        "numberOfRuns": 3
      },
      "assert": {
        "assertions": {
          "categories:performance": ["error", { "minScore": 0.95 }],
          "categories:accessibility": ["error", { "minScore": 0.95 }],
          "categories:best-practices": ["error", { "minScore": 0.95 }],
          "categories:seo": ["error", { "minScore": 0.95 }]
        }
      },
      "upload": { "target": "filesystem", "outputDir": "reports/lhci" }
    }
  }
  ```
  Script `"lhci": "lhci autorun"`. Configuración por defecto de Lighthouse (móvil, throttling simulado) y agregación por defecto de `lhci` sobre las 3 ejecuciones.
- **PokéAPI real, no simulada.** Motivos: `lhci` no ofrece interceptación de peticiones; un mock local exigiría otro origen y cambiar `connect-src` de la CSP (la página auditada dejaría de ser la publicada); y el presupuesto de performance debe medir la latencia real que verá el usuario. Coste: variabilidad. Mitigación prevista por el plan: si performance mide < 0,95 por la latencia de PokéAPI, su aserción pasa a `["warn", { "minScore": 0.95 }]` en un commit propio y el PR documenta la cifra (mediana de las 3 ejecuciones por página). Accesibilidad, buenas prácticas y SEO siguen siendo `error`.
- Chrome: el de `ubuntu-latest` en CI; `/usr/bin/google-chrome` en local (detectado por `chrome-launcher`).
- Sin subida a servicios externos: informes en `reports/lhci` (ignorado) y `.lighthouseci/` añadido a `.gitignore`, `.prettierignore` y a los `ignores` de ESLint.

### D11. CI y configuración de herramientas

- `ci.yml`, job `calidad`: `timeout-minutes: 25`; tras `npm run test:mutation` (Node 24) se añaden, todos con `if: matrix.node == 24`: `npm run test:mutation:ui`, `npx playwright install --with-deps chromium`, `npm run e2e`, y `npm run lhci` con `if: matrix.node == 24 && github.event_name == 'pull_request'`. Sin secretos; permisos `contents: read` sin cambios.
- `eslint.config.js`: bloque `tests/e2e/**/*.js` con `globals.node` + `globals.browser`; `playwright.config.js` con `globals.node`; `ignores` añade `test-results/`, `playwright-report/`, `.lighthouseci/`.
- `.gitignore` y `.prettierignore`: `test-results/`, `playwright-report/`, `.lighthouseci/`.
- `package.json`: devDependencies `@playwright/test`, `@axe-core/playwright`, `@lhci/cli` (versión estable vigente con `^`, fijada por `package-lock.json`); scripts `e2e`, `lhci`, `test:mutation:ui`. `npm test` no cambia (`tests/e2e` queda fuera de su glob).
- `pages.yml` no cambia.

### D12. Commits

Orden: `docs(openspec): añade el cambio de la fase 4`; `test(ui): cubre layout y render con escapado y estructura`; `test(mutation): añade la config de Stryker para la capa ui`; `test(e2e): añade el smoke de Playwright con PokéAPI simulada`; `feat(site): añade skip-link, noscript y región de estado`; `feat(ui): abre el detalle en un dialog nativo con foco gestionado`; `feat(ui): anuncia el estado de los desplegables y cierra con Escape`; `fix(site): hace el menú móvil accesible por teclado`; `feat(ui): respeta prefers-reduced-motion y prefers-color-scheme`; `fix(ui): da nombre accesible a la búsqueda y zonas desplazables`; `fix(css): ajusta el contraste a AA y audita con axe`; `ci: ejecuta mutación de ui y e2e en Node 24`; `ci(lhci): ejecuta Lighthouse CI en los PR`; solo si aplica (D10), `ci(lhci): rebaja performance a aviso por la latencia de PokéAPI`; commit de archivo. Respecto al plan: el smoke e2e entra pronto (para escribir cada caso en rojo antes de su comportamiento), la auditoría axe entra con los ajustes de contraste que la hacen pasar y no hay commit de documentación aparte: cada commit actualiza la sección `Accesibilidad`/`Tests` del `README.md`, `CONTRIBUTING.md` y la plantilla de PR que le corresponden. Como en fases anteriores, el avance de casillas de `tasks.md` entra en el commit de archivo.

## Risks / Trade-offs

- [Lighthouse performance < 0,95 por PokéAPI real o por el throttling móvil] → aserción a `warn` con la cifra documentada en el PR (D10); las otras tres categorías siguen bloqueando.
- [Lighthouse inestable en CI por la red] → solo en PR, 3 ejecuciones y dos páginas; un fallo transitorio se reintenta relanzando el job, sin tocar umbrales.
- [`test:mutation:ui` > 180 s] → división en dos configs (D7).
- [Contraste verificado solo en lo que pintan los datos sintéticos] → el catálogo de tipos usa los 18 tipos reales; sabores, clases de daño y estadísticas de naturaleza solo se ven con los valores del fixture: las clases no pintadas se revisan con la fórmula WCAG al tocar la paleta y se anotan en el PR.
- [El tema `gray` es claro y se elige con esquema oscuro] → decisión del plan; se mantiene y se documenta en el README.
- [Sin JavaScript el menú no se despliega] → el `<noscript>` explica que la web necesita JavaScript; la web no funciona sin él desde su origen.
- [El retorno del foco busca la tarjeta por id] → si la tarjeta no existe (no debería: el diálogo se pinta con ella) el foco queda donde lo deje el navegador, sin error.
- [Guarda de literales fuera de la mutación de `ui`] → sigue en `npm test` y en CI; solo se omite donde el código está instrumentado.
- [Navegadores de Playwright en CI alargan el job] → solo Chromium y solo en Node 24; `timeout-minutes: 25`.

## Migration Plan

- Sin migración de datos. Diferencia visible: quien no tenía tema guardado lo seguía teniendo guardado como `normal` (la versión anterior guardaba siempre el inicial); esas visitas mantienen `normal`. Las nuevas sin clave siguen la preferencia del sistema.
- Despliegue: merge a `main` → CI → Pages (`workflow_run`).
- Marcha atrás: `git revert` del merge en una rama nueva + PR; no quedan datos que limpiar.
