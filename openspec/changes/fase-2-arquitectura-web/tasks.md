# Tareas: Fase 2 — arquitectura de la web

Reglas para todos los commits: asunto exacto indicado, Conventional Commits en español, imperativo, < 72 caracteres, sin punto final, sin `Co-Authored-By` ni mención a IA, identidad git sin cambios. Cada commit pasa por el hook de pre-commit (no usar `--no-verify`). El avance de casillas de este fichero no se añade a commits intermedios: entra en el commit de archivo (design.md D9).

TDD obligatorio en cada módulo: **Rojo** (escribir el test, ejecutarlo y comprobar que falla por el motivo esperado), **Verde** (código mínimo hasta pasar), **Refactor** (limpiar con los tests en verde). Tests en Node, sin red ni DOM real, con fakes antes que mocks; cada fichero de test debe terminar en < 2 s. Selección de entradas: particiones de equivalencia, valores límite, casos dorados y adivinación de errores.

## 1. Rama de trabajo

- [ ] 1.1 Actualizar `main` y crear la rama: `git switch main && git pull --ff-only origin main && git switch -c refactor/fase-2-arquitectura-web`; verificar con `git status` que la rama es `refactor/fase-2-arquitectura-web`, que el árbol está limpio salvo `openspec/changes/fase-2-arquitectura-web/` y que `npm ci && npm test` pasa con 135 tests.
- [ ] 1.2 Versionar el cambio: `git add openspec/changes/fase-2-arquitectura-web` y verificar `openspec validate fase-2-arquitectura-web --strict` en verde. Commit `docs(openspec): añade el cambio de la fase 2`.

## 2. Comando de mutación

- [ ] 2.1 En `stryker.config.json` cambiar `commandRunner.command` a `node --test "site/js/core/**/*.test.js" "site/js/mappers/**/*.test.js"` sin tocar `mutate`, `thresholds` ni `ignorePatterns: ["tsconfig.json"]` (design.md D8); verificar con `time npm run test:mutation` que la puntuación no baja de la de `main` (≥ 95 %) y que tarda ≤ 180 s. Commit `build(mutation): limita Stryker a los tests de core y mappers`.

## 3. Cliente HTTP `site/js/api/client.js`

- [ ] 3.1 Rojo: crear `site/js/api/client.test.js` con un `fetch` falso (cola de respuestas `{ status, body }` o errores, que registra llamadas y la `signal` recibida) y `t.mock.timers.enable({ apis: ['setTimeout'] })` más un helper que alterna `tick` con `await new Promise(setImmediate)` (design.md, riesgos). Casos: 200 → JSON en 1 llamada; 503→200 en 2 llamadas con espera de 500 ms (sin resolver a los 499 ms); `TypeError`→429→200 en 3 llamadas con 500 y 1000 ms; 500 ×3 → rechazo con `status` 500 tras 3 llamadas; `retries = 0` + 503 → 1 llamada; 404 → rechazo con `name: 'HttpError'` y `status` 404 tras 1 llamada; 400 y 499 sin reintento; señal ya abortada → `AbortError` y 0 llamadas; aborto durante la espera → `AbortError` tras 1 llamada; `fetch` que no resuelve → `TimeoutError` a los `timeoutMs` (no antes) y señal de `fetch` abortada; JSON inválido → `SyntaxError` sin reintento; `cache = new Map()` → 2 llamadas a `fetchJson`, 1 a `fetch`; 404 con caché → caché vacía; importación sin `window`/`document` sin efectos. Verificar que `npm test` falla porque `client.js` no existe.
- [ ] 3.2 Verde: implementar `createFetchJson` según design.md D1 (`// @ts-check` + JSDoc, `fetch` por defecto resuelto en la llamada, plazo total con un único temporizador y `AbortSignal.any`, esperas cancelables); añadir `"site/js/api/**/*.js"` a `include` de `tsconfig.json`. Verificar `npm test`, `npm run lint` y `npm run typecheck` en verde; comprobar el rojo del typecheck inyectando temporalmente `(1).foo();` en `client.js` (debe fallar) y revertir.
- [ ] 3.3 Refactor: extraer funciones pequeñas con nombre (p. ej. `isRetriable`, `waitBackoff`) sin cambiar tests; verificar `npm test` en verde. Mutación del diff: crear `reports/stryker-diff.config.json` (copia de `stryker.config.json` con `commandRunner.command: "npm test"` y `mutate: ["site/js/api/client.js"]`) y ejecutar `timeout 180 npx stryker run reports/stryker-diff.config.json`; verificar > 95 % o anotar cada superviviente justificado para el PR. Commit `feat(api): añade el cliente fetchJson con reintentos y timeout`.

## 4. Cancelación en `pagehide`

- [ ] 4.1 Rojo: crear `site/js/ui/cancelable-load.test.js` con un `EventTarget` nativo como ventana falsa y una `load(signal)` falsa. Casos: carga que resuelve sin `pagehide` → devuelve el resultado; `pagehide` durante la carga → la `signal` recibida queda abortada y devuelve `null` aunque `load` resuelva `{ status: 'error' }` (escenario «Navegación durante la carga»); `pagehide` tras terminar → no aborta y el listener ya está retirado; `load` que rechaza sin aborto → propaga el error. Verificar que `npm test` falla porque el módulo no existe.
- [ ] 4.2 Verde: implementar `loadUntilPageHide(target, load)` (design.md D3). En `main.js`: crear `fetchJson` con `createFetchJson({})`, eliminar la función `fetchJson` local, adaptar al contrato de `loadSection` (D2) dentro de `loadUntilPageHide(window, (signal) => …)`, no pintar nada si el resultado es `null` y repetir `start()` en `pageshow` con `event.persisted` solo si la última carga devolvió `null`. Verificar `npm test`, `npm run lint` y `npm run typecheck` en verde y, por revisión, que `main.js` ya no llama a `fetch` directamente.
- [ ] 4.3 Refactor y mutación del diff con `mutate: ["site/js/ui/cancelable-load.js"]` en `reports/stryker-diff.config.json` (> 95 % o supervivientes justificados). Verificación manual opcional: `python3 -m http.server -d site`, abrir `index.html?q=a` y navegar a otra sección durante `CARGANDO...` sin ver el mensaje de error. Commit `feat(ui): cancela las cargas pendientes al salir de la página`.

## 5. Tema sin efectos `site/js/ui/theme.js`

- [ ] 5.1 Rojo: crear `site/js/ui/theme.test.js` con un `document` falso (D4: `getElementById`, `querySelectorAll`, `addEventListener` y elementos con `hidden`, `dataset`, `classList.toggle`, `addEventListener`/disparo de `click` con `stopPropagation`) y `storage` falsos (con `Map`, vacío, `null`, y uno cuyo `getItem`/`setItem` lanzan). Casos: importar `theme.js` en Node no lanza (hoy lanza por `document`); guardado `gb` → `data-theme="gb"` y solo la opción `gb` activa; vacío → `normal`; `null` → `normal`; clic en la opción `gray` → `data-theme="gray"`, `setItem('theme', 'gray')` y desplegable oculto; almacenamiento que lanza + clic en `gray` → `gray` sin excepción; clic en `#theme-btn` alterna el desplegable; clic en `#info-btn` alterna el panel y cierra el de tema; clic en `document` cierra ambos. Verificar que `npm test` falla.
- [ ] 5.2 Verde: exportar `initTheme(document, storage)` sin código de nivel superior que toque DOM o almacenamiento; en `main.js` sustituir `import './theme.js'` por la llamada a `initTheme(document, storage)` con `storage` obtenido en `try/catch` de `window.localStorage` (D4). Verificar `npm test` y `npm run lint` en verde y, por revisión, que la clave `theme`, los valores y el valor por defecto `normal` no cambian.
- [ ] 5.3 Refactor y mutación del diff con `mutate: ["site/js/ui/theme.js"]` (> 95 % o supervivientes justificados). Commit `refactor(ui): elimina los efectos al importar theme.js`.

## 6. Textos centralizados `site/js/ui/strings.js`

- [ ] 6.1 Rojo: crear `site/js/ui/strings.test.js` con: `STRINGS` congelado en todos sus niveles (asignar y añadir claves en modo estricto lanza `TypeError`, en cada grupo); cada valor es una cadena no vacía; guarda de literales sobre `render-*.js`, `layout.js` y `main.js` según design.md D5, con un subtest por fichero que nombra el fichero; casos de la propia guarda (un texto `<span>HOLA</span>` y un `'POW'` se detectan; `<span>${x}</span>`, `'type-badge'` y `'—'` no). Verificar que `npm test` falla por el módulo ausente y, tras crearlo vacío, por los literales actuales de cada fichero.
- [ ] 6.2 Verde: crear `strings.js` con los textos actuales **sin cambiar su valor** (incluidos `HIDDEN`, `◀ PREV` y `NEXT ▶` de momento) y sustituir los literales en los 7 `render-*.js`, `layout.js` (`BUSCAR...` incluido) y `main.js` (mensajes de carga, vacío y error). Verificar `npm test`, `npm run lint` y `npm run format:check` en verde, y que `git diff --stat` no toca `site/js/core`, `site/js/mappers` ni HTML.
- [ ] 6.3 Refactor (nombres de claves y agrupación por vista) con tests en verde. Commit `refactor(ui): centraliza los textos de la interfaz en strings.js`.

## 7. Textos en español

- [ ] 7.1 Rojo: añadir a `strings.test.js` (o `site/js/ui/layout.test.js`) tests de salida: `paginationNav({ page: 2, total: 3, prevHref: '?page=1', nextHref: '?page=3' })` contiene `◀ ANT.` y `SIG. ▶` y no contiene `PREV` ni `NEXT`, también con ambos `href` a `null` (límite); `pokedexView.renderOverlays` con el fixture `site/js/mappers/fixtures/pokemon.json` mapeado contiene `OCULTA` y no `HIDDEN` (y un Pokémon sin habilidad oculta no contiene `OCULTA`). Verificar que fallan.
- [ ] 7.2 Verde: cambiar solo esos tres valores en `strings.js`; verificar `npm test` en verde y con `git diff` que no cambia ningún otro texto. Commit `fix(ui): traduce al español la etiqueta oculta y la paginación`.

## 8. Página activa con `aria-current`

- [ ] 8.1 Rojo: `grep -c 'aria-current="page"' site/*.html` devuelve 0 en las 7 páginas.
- [ ] 8.2 Verde: en cada HTML, el enlace a sí misma pasa a `<a href="<fichero>" class="nav-link active" aria-current="page">`; verificar que el `grep` anterior devuelve 1 en cada página, que en cada una el `href` de esa línea es su propio nombre de fichero y `npm run format:check` en verde. Commit `feat(site): marca la página activa con aria-current`.

## 9. Comprobación de cabeceras `scripts/check-html.mjs`

- [ ] 9.1 Cambiar el script `test` a `node --test "site/js/**/*.test.js" "scripts/**/*.test.mjs"` y verificar que `npm test` sigue en verde con el mismo número de tests.
- [ ] 9.2 Rojo: crear `scripts/check-html.test.mjs` con HTML en memoria para `extractHeader` y `findHeaderMismatches` (design.md D6): 7 páginas iguales salvo su marca → `[]`; `tipos.html` con un enlace distinto → `['tipos.html']` (escenario «Cabecera divergente»); `bayas.html` con la marca en el enlace de `tipos.html` → `['bayas.html']`; página sin `aria-current` → divergente; página sin `<header>` → divergente; `index.html` divergente → todas las demás listadas. CLI con `spawnSync(process.execPath, ['scripts/check-html.mjs', dirTemporal])` sobre una copia de `site/*.html` en `fs.mkdtempSync(os.tmpdir())` con `tipos.html` alterado → código 1 y `stderr` contiene `tipos.html`; prueba dorada sobre `site/` real → código 0. Verificar que `npm test` falla.
- [ ] 9.3 Verde: implementar `scripts/check-html.mjs` sin dependencias; añadir el script `check:html` (`node scripts/check-html.mjs`) en `package.json` y el paso `- run: npm run check:html` en `.github/workflows/ci.yml` tras `typecheck` (en ambas versiones de Node). Verificar `npm test`, `npm run check:html` (código 0), `npm run lint` y `npm run format:check` en verde.
- [ ] 9.4 Refactor y mutación del diff con `mutate: ["scripts/check-html.mjs"]` (> 95 % o supervivientes justificados). Documentar `npm run check:html` en la tabla de comandos y la lista previa al PR de `CONTRIBUTING.md` y como sexta casilla de `.github/PULL_REQUEST_TEMPLATE.md`; verificar `grep -c '^- \[ \]' .github/PULL_REQUEST_TEMPLATE.md` = 6. Commit `ci(html): comprueba que las cabeceras de las páginas coinciden`.

## 10. Versión `site/js/version.js`

- [ ] 10.1 Rojo: crear `scripts/sync-version.test.mjs`: `renderVersionModule('1.0.1')` igual a un texto dorado (comentario de fichero generado + `export const VERSION = '1.0.1';` + salto final); `syncVersion` sobre un `package.json` y una salida en un directorio temporal escribe ese texto; `package.json` sin `version` → error descriptivo. Crear `site/js/version.test.js` que compara `VERSION` con `version` de `package.json` mostrando ambos valores. Verificar que `npm test` falla.
- [ ] 10.2 Verde: añadir `"version": "1.0.0"` a `package.json`; implementar `scripts/sync-version.mjs` (D7) y ejecutarlo para generar `site/js/version.js`; añadir el script npm `version` (`node scripts/sync-version.mjs && git add site/js/version.js`). En los 7 HTML sustituir `<span class="info-value">1.0</span>` por `<span class="info-value" data-version></span>` y en `main.js` rellenarlo con `VERSION`. Verificar `npm test`, `npm run format:check`, `npm run check:html` en verde y `grep -c '>1\.0<' site/*.html` = 0 en las 7. Verificar el escenario «Versión desincronizada»: cambiar temporalmente `version` a `1.0.1` → `npm test` falla mostrando ambos valores; `node scripts/sync-version.mjs` → vuelve a verde; revertir ambos ficheros con `git checkout`.
- [ ] 10.3 Refactor y mutación del diff con `mutate: ["scripts/sync-version.mjs"]` (> 95 % o supervivientes justificados). Commit `feat(site): muestra la versión desde version.js`.

## 11. Pureza de `core` y `mappers`

- [ ] 11.1 Crear `site/js/purity.test.js` (design.md D8) y comprobar su rojo: inyectar temporalmente `document.title;` al principio de `site/js/core/html.js` y verificar que el test falla nombrando `html.js`; revertir con `git checkout -- site/js/core/html.js`. Verificar `npm test` en verde con un subtest por cada módulo no-test de `core` (6) y `mappers` (8). Commit `test(core): verifica que core y mappers se importan sin DOM`.

## 12. Meta `description`

- [ ] 12.1 Rojo: `grep -l 'cadenas evolutivas' site/*.html` lista las 7 páginas. Verde: sustituir la meta `description` de las 7 por `Pokédex retro interactiva. Explora los Pokémon con estética de consola clásica de los 90: stats, tipos y habilidades.`; verificar que el `grep` no devuelve nada, `npm run format:check` y `npm run check:html` en verde. Commit `fix(site): corrige la meta description de las páginas`.

## 13. Documentación

- [ ] 13.1 Actualizar `README.md`: estructura de `site/js` con `api/` (cliente con reintentos, timeout y cancelación), `version.js` y `ui/strings.js`; `scripts/` con `check-html.mjs` y `sync-version.mjs`; sección de tests con `npm run check:html` y que `npm test` incluye `scripts/`; mención a `npm version` para cambiar la versión. Verificar `npm run format:check` en verde y que el README no menciona carpetas locales excluidas. Commit `docs(readme): documenta la arquitectura de la fase 2`.

## 14. Comprobaciones de cierre

- [ ] 14.1 Ejecutar desde limpio `npm ci`, `npm test` (≥ 135 tests, todos en verde), `npm run lint`, `npm run format:check`, `npm run typecheck` (incluye `site/js/api`), `npm run check:html` y `time npm run test:mutation` (≤ 180 s, `core` + `mappers` ≥ 95 %); verificar todo en verde. Si `timeout` aborta la mutación, parar y dividir la config según la regla común 5 antes de seguir.
- [ ] 14.2 Verificar por revisión los escenarios de `specs/`: «Reintento ante 503», «Sin reintento ante 404», «Navegación durante la carga» y «Cabecera divergente» tienen un test que los cubre y pasa; `grep -rn "HIDDEN\|PREV\|NEXT" site/js/ui` sin resultados; `site/js/core` y `site/js/mappers` sin cambios (`git diff --stat main -- site/js/core site/js/mappers` vacío).
- [ ] 14.3 Verificar que `git log --format='%s%n%b' main..HEAD` no contiene `Co-Authored-By` ni menciones a IA, que los asuntos coinciden con los de este fichero y tienen < 72 caracteres sin punto final, y que ningún fichero versionado nuevo menciona carpetas locales excluidas (`grep -v '^#' .git/info/exclude | xargs -I{} git grep -nF {} -- docs README.md CONTRIBUTING.md scripts site` sin resultados).

## Workflow follow-up

Pasos posteriores, en este orden (tasks.md ya está archivado cuando ocurren):

- Archivar el cambio: `openspec archive fase-2-arquitectura-web --yes` (o el procedimiento de `.claude/commands/opsx/archive.md`); verificar que se crean `openspec/specs/cliente-http/spec.md` y `openspec/specs/interfaz-web/spec.md`, que `calidad-codigo`, `integracion-continua` y `gobierno-repositorio` reflejan los requisitos modificados y que el cambio queda en `openspec/changes/archive/<fecha>-fase-2-arquitectura-web/`; `openspec validate --specs --strict` en verde. Commit `docs(openspec): archiva el cambio fase-2-arquitectura-web`.
- Publicar la rama: `git push -u origin refactor/fase-2-arquitectura-web`.
- Abrir el PR: `gh pr create --base main --title "Fase 2: arquitectura de la web" --body-file <cuerpo en español>` con la plantilla de PR rellenada (resumen, lista de commits, checklist de seis comprobaciones marcada, resultados de la mutación del diff y supervivientes justificados, nota sobre `AbortSignal.any` y el cambio de comando de Stryker); sin atribución a IA.
- Esperar el CI del PR: `gh pr checks --watch`; los dos jobs (Node 22 y 24) en verde, incluido el paso `check:html`. Si falla, corregir en la rama con un commit nuevo (nunca force-push a `main`).
- Fusionar: `gh pr merge --rebase --delete-branch`; después `git switch main && git pull --ff-only`.
- Verificar el despliegue encadenado: `gh run list --workflow ci.yml --branch main --limit 1` en `success`, luego `gh run list --workflow pages.yml --event workflow_run --limit 1` y `gh run watch <id> --exit-status` en `success`, con `headSha` igual al último commit de `main`.
- Verificar la web: `curl -sS -o /dev/null -w '%{http_code}' https://renzoramosdev.github.io/Pokedex-Retro/` devuelve `200`; `curl -sS https://renzoramosdev.github.io/Pokedex-Retro/tipos.html | grep -c 'aria-current="page"'` devuelve `1` y `curl -sS https://renzoramosdev.github.io/Pokedex-Retro/js/version.js` contiene `1.0.0`.
