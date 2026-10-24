# Propuesta: pulido de la versión 1.1.1

## Why

La `v1.1.0` publicada tiene cuatro defectos visibles contra la PokéAPI real y la demo: la tabla de TIPOS muestra una fila y una columna `stellar` vacías (el MCP ya la excluye), todos los precios de OBJETOS salen como «—» porque PokéAPI ya no devuelve `cost`, el GIF de la demo enseña a PIKACHU como fantasma/veneno y Dependabot propone `@types/node` 26 aunque el proyecto apunta a Node 22. Además, Lighthouse marca 0,82–0,86 de rendimiento en `index.html`, en parte por la cascada de importaciones de módulos ES. Esta versión de parche corrige todo ello sin añadir funcionalidad nueva.

## What Changes

- La web excluye `stellar` de la sección TIPOS, igual que `unknown` y `shadow`; web y MCP comparten una única lista de exclusión (el MCP deja de añadir `stellar` por su cuenta).
- El precio de un objeto se toma de `cost` si es un número; si no, del `purchase_price` de la última entrada de `prices` en `poke-dollar` con precio positivo; si no hay, `null` («—» como hoy). Afecta a la web y al campo `cost` de las tools de objetos del MCP.
- La PokéAPI simulada del e2e da a `#25 pikachu` su tipo real `electric` e incluye `stellar` en la lista de tipos; se regenera `docs/media/demo.gif`.
- Cada página HTML precarga con `<link rel="modulepreload">` todo el grafo estático de módulos de `js/ui/main.js`, con un test que impide que la lista se desincronice. Solo se conserva si Lighthouse no empeora.
- `.github/dependabot.yml` ignora las subidas de versión mayor de `@types/node` en cada entrada `npm`; tras fusionar se cierra el PR #6 de Dependabot explicando el motivo.
- Versión `1.1.1` en manifiestos, lockfiles, `mcp/server.json` y `site/js/version.js`, entrada `[1.1.1]` en `CHANGELOG.md` y etiqueta anotada `v1.1.1`.

Fuera de alcance: cambiar los umbrales de Lighthouse, mostrar precios por versión de juego o en otras monedas, cambiar el nombre del campo `cost`, publicar el paquete del MCP.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `interfaz-web`: tabla de tipos sin `stellar`, `unknown` ni `shadow`; precio de los objetos derivado de `prices`; precarga del grafo de módulos.
- `integracion-continua`: Dependabot no propone versiones mayores de `@types/node`.
- `documentacion-proyecto`: la demo muestra a PIKACHU con su tipo real.

## Impact

- **Código**: `site/js/core/sections.js`, `site/js/mappers/item.js`, `mcp/src/type-chart.js`, los 7 HTML de navegación de `site/`, `tests/e2e/pokeapi-mock.js`.
- **Tests y fixtures**: `site/js/core/sections.test.js`, `site/js/core/load-section.test.js`, `site/js/mappers/item.test.js`, nuevo fixture `site/js/mappers/fixtures/item-ultra-ball.json`, nuevo test del grafo de módulos, `tests/e2e/smoke.spec.js`.
- **Configuración**: `.github/dependabot.yml`.
- **Medios y versión**: `docs/media/demo.gif`, `CHANGELOG.md`, `package.json`, `package-lock.json`, `mcp/package.json`, `mcp/package-lock.json`, `mcp/server.json`, `site/js/version.js`.
- **MCP**: las tools de objetos devuelven `cost` numérico cuando PokéAPI tiene precio en `poke-dollar`; el esquema (`entero` o `null`) no cambia.
- **Dependencias**: ninguna nueva.
