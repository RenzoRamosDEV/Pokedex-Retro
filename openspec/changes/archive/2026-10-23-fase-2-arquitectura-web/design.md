# Diseño: Fase 2 — arquitectura de la web

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: ver `specs/`.

Estado observado en `main` (fase 1 fusionada):

- `site/js/ui/main.js` define `fetchJson(url)` (`fetch` directo, devuelve `{ ok, status, json }`) y llama a `loadSection(fetchJson, SECTIONS[sección], parsedQuery)`. Importa `./theme.js` por sus efectos. Mensajes `CARGANDO...`, `SIN RESULTADOS` y de error como constantes locales.
- `site/js/core/load-section.js`: el contrato con `fetchJson` es `{ ok, status, json }`; un rechazo en la lista se traduce en `{ status: 'error' }` y un rechazo en un detalle en `null` (se filtra).
- `site/js/ui/theme.js`: consulta `#theme-btn`, `#theme-dropdown`, `.theme-option`, `#info-btn`, `#info-dropdown` y llama a `applyTheme(localStorage.getItem('theme') || 'normal')` al importarse; `setItem` sin protección. También conecta el panel INFO y el cierre al hacer clic fuera.
- Literales visibles en `render-pokedex.js` (`HIDDEN`, `INFO`, `HEIGHT`, `WEIGHT`, `BASE EXP`, `ABILITIES`, `BASE STATS`, `Ver detalles de`, `Cerrar`, `m`, `kg`), `render-moves.js` (`POW`, `ACC`, `PP`, `PRI`), `render-types.js` (`ATK ╲ DEF`, leyenda), `render-natures.js` (`SUBE`, `BAJA`, `SIN CAMBIO DE STATS`, `NEUTRAL`, `naturales`), `render-items.js` (cabeceras de tabla), `render-berries.js` (`BERRY`, etiquetas de estadística, `H`), `render-abilities.js` (`POKEMON`), `layout.js` (`BUSCAR...`, `◀ PREV`, `NEXT ▶`) y los `title` de cada vista.
- Los 7 HTML comparten el `<header>` (incluye selector de tema y panel INFO con `<span class="info-value">1.0</span>`); la navegación marca la página con `class="nav-link active"` y sin `aria-current`.
- `package.json` no tiene campo `version`; `npm test` = `node --test "site/js/**/*.test.js"`; ESLint ya da globales de Node a `scripts/**/*.{js,mjs}` y de navegador a `site/js/api/**`.
- `stryker.config.json`: `commandRunner` = `npm test`, `mutate` = `core` + `mappers`, `ignorePatterns: ["tsconfig.json"]` (necesario con TypeScript 7), `break: 95`, `timeout 180` en el script.
- Node 24 en local; CI con 22 y 24. `node:test` ofrece `mock.timers` en ambas.

## Goals / Non-Goals

**Goals:**

- Toda lógica nueva de `ui`, `api` y `scripts` testeable en Node con dobles ligeros (fakes), sin red ni DOM real.
- `core` y `mappers` sin cambios: su contrato y su puntuación de mutación se conservan.
- Cada módulo nuevo entra con su ciclo rojo → verde → refactor y su propio commit.

**Non-Goals:**

- Caché persistente, límite de concurrencia, aviso de detalles fallidos (fase 3).
- Tests de los `render-*.js` más allá de los textos cambiados y la guarda de literales; mutación de `ui` en la config principal (fase 4).
- Generar la cabecera desde JS o una plantilla (ADR 0001).
- `Retry-After`, *jitter* o reintento de timeouts.

## Decisions

### D1. Cliente HTTP: `fetchJson` resuelve con el JSON y rechaza ante no-2xx

`createFetchJson` devuelve `fetchJson(url, { signal })` que resuelve con el cuerpo JSON o rechaza. Errores:

| Situación | Rechazo | ¿Reintenta? |
| --- | --- | --- |
| `fetch` lanza (`TypeError`, red) | el error original | sí |
| HTTP 429 o 5xx | `Error` con `name: 'HttpError'` y `status` | sí |
| Otro no-2xx | `Error` con `name: 'HttpError'` y `status` | no |
| `signal` abortada (antes, durante petición o espera) | `DOMException('…', 'AbortError')` | no |
| plazo `timeoutMs` superado | `DOMException('…', 'TimeoutError')` | no |
| JSON inválido | el `SyntaxError` | no |

- Espera antes del reintento `n` (0-based): `500 × 2^n` ms, con `setTimeout` cancelable por la señal.
- Plazo **total** de la llamada (peticiones + esperas): un único temporizador aborta un `AbortController` interno; la señal entregada a `fetch` es `AbortSignal.any([signal del llamante, señal interna])`. Se distingue la causa comprobando qué señal se abortó. Peor caso con valores por defecto: 10 s, independientemente del número de reintentos.
  - Alternativa descartada: plazo por intento → el peor caso sería 3 × 10 s + 1,5 s y obligaría a decidir si un timeout se reintenta.
  - Alternativa descartada: `AbortSignal.timeout()` → no lo controla `mock.timers`; los tests necesitarían esperas reales.
- `cache` es un puerto mínimo `{ get(url), set(url, valor) }`; `undefined` en `get` significa fallo. Un `Map` lo cumple, lo que permite testear sin fakes propios y deja a la fase 3 enchufar la implementación persistente (ADR 0002). Solo se guardan respuestas 2xx.
- `fetch` por defecto se resuelve en la llamada (`globalThis.fetch`), no al importar, para que el módulo sea importable sin efectos.
- `// @ts-check` y JSDoc en `client.js`; `tsconfig.json` añade `site/js/api/**/*.js` a `include`.

### D2. Adaptación al contrato de `loadSection` en `main.js`

`loadSection` espera `{ ok, status, json }`. `main.js` adapta en una línea: `(url) => fetchJson(url, { signal }).then((json) => ({ ok: true, status: 200, json }))`. Los rechazos ya los traduce `loadSection` (lista → `error`, detalle → `null`).

- Alternativa descartada: cambiar `loadSection` para recibir JSON → toca `core`, sus tests y la mutación sin beneficio en esta fase.
- Alternativa descartada: exportar el adaptador desde `client.js` → la especificación pide una única fábrica exportada.

### D3. Cancelación en `pagehide` en un módulo testeable

Nuevo `site/js/ui/cancelable-load.js` con `loadUntilPageHide(target, load)`: crea un `AbortController`, registra `pagehide` en `target` (`{ once: true }`), llama a `load(signal)`, retira el listener al terminar y resuelve `null` si la señal quedó abortada (si no, el resultado de `load`). `main.js` no pinta nada cuando recibe `null`.

- Se testea con un `EventTarget` nativo de Node como `target` y una `load` falsa; sin DOM.
- Restauración desde bfcache: si la última carga terminó en `null`, `main.js` repite `start()` en `pageshow` con `event.persisted`. Evita dejar la página en `CARGANDO...`; si la carga había terminado no hace nada.
- Alternativa descartada: lógica inline en `main.js` → no testeable sin DOM (`main.js` arranca al importarse).

### D4. `initTheme(document, storage)`

- `theme.js` solo exporta `initTheme`; las constantes `THEME_KEY = 'theme'` y `DEFAULT_THEME = 'normal'` se mantienen.
- `storage` puede ser `null`; `getItem`/`setItem` se envuelven en `try/catch` (modo privado, cuota). `main.js` obtiene `window.localStorage` dentro de un `try/catch` (su mero acceso puede lanzar `SecurityError`) y pasa `null` si falla.
- Se conserva el comportamiento actual: valor guardado no vacío → se aplica tal cual; vacío → `normal`; incluye el panel INFO y el cierre por clic fuera (sin cambios de accesibilidad: fase 4).
- Tests con un fake de `document` mínimo (`getElementById`, `querySelectorAll`, `addEventListener`, `body.dataset`, elementos con `hidden`, `dataset`, `classList.toggle` y `addEventListener` que permite disparar `click`) y un fake de `storage` (objeto con `Map` o que lanza).

### D5. `strings.js` y guarda de literales

- `export const STRINGS`: objeto agrupado por vista (`comun`, `pokedex`, `movimientos`, `tipos`, `naturalezas`, `objetos`, `bayas`, `habilidades`), congelado en profundidad con un `deepFreeze` local. Incluye los `title` de las vistas, mensajes de estado, `placeholder`, `aria-label`, etiquetas, unidades (`m`, `kg`, `H`, `BERRY`, `POKEMON`) y leyendas.
- Primero se mueven los textos **sin cambiarlos** (commit `refactor`), después se cambian los tres valores (commit `fix`), para que cada diff tenga una sola intención.
- Guarda automática en `site/js/ui/strings.test.js` que lee el código fuente de `render-*.js`, `layout.js` y `main.js` y falla nombrando el fichero si:
  - en un literal de plantilla, tras quitar las interpolaciones `${…}`, el texto entre `>` y `<` o el valor de `aria-label`, `placeholder`, `title` o `alt` contiene alguna letra (`\p{L}`);
  - un literal entre comillas o una plantilla sin HTML contiene una mayúscula (`[A-ZÁÉÍÓÚÑ]`); los nombres de clase, eventos, selectores y rutas usados hoy son minúsculas.
  - Es una heurística deliberadamente simple; un falso positivo se resuelve moviendo el literal a `STRINGS`.
- Los símbolos sin letras (`—`, `✕`, `▶`, `×2`, `½`, `↑`, `↓`, `₽`, `#`) pueden quedarse en el código.

### D6. `check-html.mjs`

- Funciones puras exportadas: `extractHeader(html)` (primer `<header…</header>`) y `findHeaderMismatches(pages)` con `pages = [{ file, html }]`; referencia = `index.html`. Normalización: sustituir exactamente `<a href="<file>" class="nav-link active" aria-current="page">` por `<a href="<file>" class="nav-link">` solo para el enlace a la propia página. Así fallan tanto una navegación distinta como una marca activa ausente o en el enlace equivocado.
- CLI (solo si es el punto de entrada, comparando `import.meta.url` con `process.argv[1]`): lee `site/*.html` (o el directorio pasado como argumento), imprime `Cabecera distinta en: <fichero>` por cada divergencia en `stderr` y sale con código 1; con éxito imprime un resumen y sale con 0.
  - Alternativa descartada: referencia por mayoría → más código para el mismo resultado (falla igual con código 1).
- `package.json`: `check:html` = `node scripts/check-html.mjs`; `test` pasa a `node --test "site/js/**/*.test.js" "scripts/**/*.test.mjs"`.
- Tests: funciones puras con HTML en memoria (equivalencia y casos límite: igual, divergente, marca ausente, marca en otro enlace, sin `<header>`), CLI con `spawnSync` sobre un directorio temporal (código 1 + `tipos.html`) y prueba dorada sobre el `site/` real (código 0).

### D7. Versión

- `package.json` declara `"version": "1.0.0"` (semver equivalente al `1.0` mostrado; la fase 6 sube a `1.1.0`).
- `scripts/sync-version.mjs` exporta `renderVersionModule(version)` (texto exacto con formato Prettier y comentario de fichero generado) y `syncVersion({ packageJsonPath, outputPath })`; la CLI usa las rutas del repo. Script npm `version` = `node scripts/sync-version.mjs && git add site/js/version.js`, que `npm version` ejecuta antes de su commit.
- `site/js/version.test.js` compara `VERSION` con `package.json` (lectura con `node:fs`).
- HTML: la fila VERSIÓN queda `<span class="info-value" data-version></span>`; `main.js` hace `textContent = VERSION`. Sin JS la fila queda vacía (la web ya no funciona sin JS; `<noscript>` llega en la fase 4).

### D8. Pureza y comando de mutación

- `site/js/purity.test.js` lista con `readdir` los `*.js` no-test de `site/js/core` y `site/js/mappers` (`import.meta.dirname`), afirma `globalThis.window === undefined` y `globalThis.document === undefined`, y hace `import()` de cada uno en un subtest con el nombre del módulo.
- `stryker.config.json`: `commandRunner.command` pasa de `npm test` a `node --test "site/js/core/**/*.test.js" "site/js/mappers/**/*.test.js"`. Los mutantes solo están en `core`/`mappers`; los tests nuevos (temporizadores, `spawnSync`) no pueden matarlos y solo alargarían cada ejecución hacia el límite de 180 s. `ignorePatterns: ["tsconfig.json"]` se mantiene.
- Mutación del diff (regla TDD sobre código modificado, fuera de `npm run test:mutation`): config temporal `reports/stryker-diff.config.json` (ignorado por git) que copia la principal con `commandRunner.command: "npm test"` y `mutate` = el fichero en curso; se ejecuta con `timeout 180 npx stryker run reports/stryker-diff.config.json` para `client.js`, `cancelable-load.js`, `theme.js`, `check-html.mjs` y `sync-version.mjs`. Objetivo > 95 %; los supervivientes se justifican en el PR.

### D9. Commits

Asuntos del plan, salvo uno: `fix(ui): traduce OCULTA y la paginación ANT./SIG.` termina en punto y viola la regla común; se usa `fix(ui): traduce al español la etiqueta oculta y la paginación`. Se añaden `docs(openspec): añade el cambio de la fase 2`, `build(mutation): limita Stryker a los tests de core y mappers` (D8), `docs(readme): documenta la arquitectura de la fase 2` y el commit de archivo. Como en la fase 1, el avance de casillas de `tasks.md` entra en el commit de archivo.

## Risks / Trade-offs

- [`mock.timers` y promesas encadenadas: un `tick` no drena microtareas] → helper de test que alterna `tick` con `await` de `setImmediate` (no simulado: se habilita solo `setTimeout`).
- [`AbortSignal.any` requiere navegadores de 2023 en adelante] → aceptable para la audiencia de la web; Node 22 lo soporta. Se documenta en el PR.
- [Heurística de literales con falsos positivos/negativos] → simple y determinista; cubre los literales detectados en el diagnóstico; e2e en fase 4.
- [`main.js` sigue sin tests directos] → toda su lógica no trivial se extrae (`cancelable-load`, `initTheme`, cliente); lo restante es cableado, verificado por lint, typecheck y revisión.
- [El panel INFO queda vacío sin JS] → aceptado (ver D7).
- [`check-html` acoplado al orden de atributos del enlace activo] → Prettier no reordena atributos; el escenario dorado sobre `site/` lo detecta.
- [Las páginas nuevas de la fase 3 (`404.html`) entrarían en la comparación] → la fase 3 decide si comparte cabecera o se excluye explícitamente en `check-html.mjs`.

## Migration Plan

- Sin datos ni API que migrar. La clave `theme` y sus valores no cambian, así que las preferencias guardadas siguen valiendo.
- Despliegue: el merge a `main` dispara CI y, en verde, Pages (`workflow_run`).
- Marcha atrás: `git revert` del merge en una rama nueva + PR; ningún cambio es irreversible.
