# Tareas: pulido de la versión 1.1.1

Reglas para todos los commits: Conventional Commits con tipo en inglés y descripción en español, imperativo, < 72 caracteres, sin punto final, sin `Co-Authored-By` ni mención a IA, identidad git sin cambios, hook de pre-commit sin `--no-verify`. El avance de casillas entra en el commit de archivo.

TDD obligatorio para toda lógica: **Rojo** (test que falla por el motivo esperado), **Verde** (mínimo para pasar), **Refactor** (con los tests en verde). Tests con `node:test`, sin red, rápidos; entradas por particiones, límites, ficheros dorados y adivinación de errores; fakes antes que mocks.

Mutación solo del diff: `reports/stryker-*.config.json` (ignorado por git) con `mutate` limitado a los rangos cambiados; cada ejecución ≤ 180 s; objetivo > 95 % en `core`/`mappers` o supervivientes justificados.

## 1. Rama y cambio

- [x] 1.1 Rama `fix/pulido-1-1-1` desde `main` actualizado; `openspec validate pulido-1-1-1 --strict` en verde. Commit `docs(openspec): añade el cambio pulido-1-1-1`.

## 2. Dependabot

- [x] 2.1 Añadir el `ignore` de design.md D5 a la entrada `npm` de `/` en `.github/dependabot.yml`. Verificar `npm run format:check` y que el YAML parsea con la regla en esa entrada. Commit `ci(dependabot): ignora versiones mayores de @types/node`.

## 3. Tipos sin `stellar`

- [x] 3.1 Rojo: en `site/js/core/sections.test.js` esperar `exclude: ['stellar', 'unknown', 'shadow']`; en `site/js/core/load-section.test.js` añadir `stellar` a los casos de exclusión (no aparece en los resultados y no se pide su detalle); en el MCP la exclusión ya la cubre `never requests stellar, unknown or shadow details` de `mcp/test/efectividad.test.js`, que debe seguir en verde al quitar su lista propia. Verificar con `npm test` que fallan por la ausencia de `stellar`.
- [x] 3.2 Verde: `SECTIONS.tipos` con los tres tipos y `mcp/src/type-chart.js` usando `SECTIONS.tipos` sin añadir nada. Verificar `npm test` y `npm run mcp:test` en verde. Commit `fix(tipos): excluye el tipo stellar de la tabla de la web`.

## 4. Precio de los objetos

- [x] 4.1 Capturar `item/ultra-ball` de PokéAPI y guardarlo recortado (design.md D2) como `site/js/mappers/fixtures/item-ultra-ball.json`.
- [x] 4.2 Rojo: en `site/js/mappers/item.test.js` golden de ultra-ball (`cost` 600) y los casos de D2 (prices vacío/ausente, `purchase_price` `null`/0/1, moneda distinta al final, `cost` 0 y `cost` con `prices`). Verificar con `npm test` que fallan por el motivo esperado.
- [x] 4.3 Verde y refactor en `site/js/mappers/item.js`. Verificar `npm test`, `npm run mcp:test` (golden del MCP sin cambios) y mutación del diff de `item.js` > 95 %. Commit `fix(objetos): obtiene el precio de la lista prices de PokéAPI`.

## 5. Demo realista

- [x] 5.1 Rojo: en `tests/e2e/smoke.spec.js`, el diálogo de PIKACHU muestra `ELECTRIC` y la tabla de tipos tiene 18 cabeceras de fila sin `STELLAR`; `npm run e2e` falla en el primero.
- [x] 5.2 Verde: parche mínimo de design.md D3 en `tests/e2e/pokeapi-mock.js`; `npm run e2e` en verde. Commit `test(e2e): da a pikachu su tipo real en la PokéAPI simulada`.
- [x] 5.3 Regenerar `docs/media/demo.gif` con `node scripts/capture-demo.mjs`; verificar ≤ 3 000 000 bytes, ≤ 15 s y revisar a ojo un fotograma del diálogo. Commit `docs(media): regenera el GIF de demo con pikachu eléctrico`.

## 6. Precarga de módulos

- [x] 6.1 Medición base con `npm run lhci` (medianas de 3 ejecuciones por página) anotada para el PR.
- [x] 6.2 Rojo: `site/js/module-preload.test.js` según design.md D4; `npm test` falla nombrando las páginas y los módulos que faltan.
- [x] 6.3 Verde: añadir los `modulepreload` a los 7 HTML; `npm test`, `npm run check:html` y `npm run e2e` (sin violaciones de CSP) en verde.
- [x] 6.4 Medir de nuevo con `npm run lhci`; conservar el cambio solo si ninguna mediana de rendimiento empeora (si empeora, revertir y documentar en design.md D4 sin commit de código). Si se conserva, commit `perf(web): precarga el grafo de módulos de cada página`. Resultado: empeora `index.html` (0,82 → 0,81, LCP +150 ms); revertido y documentado en design.md D4.

## 7. Versión 1.1.1

- [x] 7.1 Entrada `[1.1.1]` en `CHANGELOG.md` (Corregido / Cambiado) y versión `1.1.1` según design.md D6; `npm test` (coherencia de versiones), `npm run mcp:test`, lint, formato y typecheck en verde. Commit `chore(release): publica la versión 1.1.1`.
- [x] 7.2 Corregir las afirmaciones que dejan de ser ciertas: `mcp/README.md` (la web ya excluye `stellar`) y `docs/PLAN.md` (estado y seguimiento del precio). Verificar `npm run format:check`. Commit `docs: alinea el README del MCP y el plan con la versión 1.1.1`.

## 8. Comprobaciones de cierre

- [x] 8.1 Desde limpio: `npm ci`, `npm ci --prefix mcp`, `npm test`, `npm run mcp:test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html`, `npm run test:mutation` (≥ 95 %), `npm run test:mutation:ui` (≥ 85 %), `npm run mcp:test:mutation` (≥ 85 %), cada ejecución ≤ 180 s, y `npm run e2e`, todo en verde.
- [x] 8.2 `git log --format='%s%n%b' main..HEAD` sin `Co-Authored-By` ni menciones a IA; asuntos < 72 caracteres sin punto final; nada de `requirements/`, `.claude/` ni `.serena/` versionado.

## Workflow follow-up

- Archivar: `openspec archive pulido-1-1-1 --yes`, `openspec validate --specs --strict`; commit `docs(openspec): archiva el cambio pulido-1-1-1`.
- `git push -u origin fix/pulido-1-1-1`, PR, `gh pr checks --watch`, `gh pr merge --rebase --delete-branch` con todo en verde.
- Verificar el despliegue de Pages (`workflow_run` con `headSha` igual a `main`).
- Etiqueta anotada `v1.1.1` (`chore(release): versión 1.1.1`) sobre el commit fusionado y `git push origin v1.1.1`.
- `gh pr close 6` con un comentario en español sobre la regla de Dependabot.
