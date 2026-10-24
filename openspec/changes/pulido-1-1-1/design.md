# Diseño: pulido de la versión 1.1.1

## Context

Ver proposal.md («Why»). Estado actual relevante:

- `site/js/core/sections.js` define `SECTIONS.tipos` con `exclude: ['unknown', 'shadow']`; `mcp/src/type-chart.js` construye su propia configuración añadiendo `'stellar'`. La exclusión se aplica en `loadSection` antes de pedir detalles.
- `site/js/mappers/item.js` hace `cost: json.cost ?? null`; la PokéAPI actual no devuelve `cost` sino `prices` (lista dispersa por versión de juego). El mapper lo comparten la web y el MCP; los tests del MCP usan el fixture de `master-ball`, que no tiene `prices`.
- `tests/e2e/pokeapi-mock.js` clona el fixture de Pokémon (tipos fantasma/veneno) para todos los ids y su lista de tipos no incluye `stellar`.
- Las 7 páginas de navegación cargan el mismo punto de entrada `js/ui/main.js`, que importa en cascada 25+ módulos; el navegador los descubre nivel a nivel.
- Medición base (`npm run lhci`, 3 ejecuciones, medianas): `index.html` 0,85 (0,86 / 0,82 / 0,85), `tipos.html` 0,91.

## Goals / Non-Goals

**Goals:** corregir los cuatro defectos visibles, quitar la duplicación de la exclusión de tipos, mejorar o al menos no empeorar Lighthouse, y publicar `v1.1.1`.

**Non-Goals:** cambiar umbrales de Lighthouse; generar los HTML con un paso de build; mostrar precios por juego o moneda; renombrar `cost`.

## Decisions

### D1. Una sola lista de exclusión: `SECTIONS.tipos.exclude`

`SECTIONS.tipos` pasa a `['stellar', 'unknown', 'shadow']` y `mcp/src/type-chart.js` usa `SECTIONS.tipos` directamente. Alternativa descartada: exportar una constante `EXCLUDED_TYPES` aparte; añade un nombre sin quitar más duplicación, porque `SECTIONS.tipos.exclude` ya es el punto único que ambos consumen.

### D2. Precio del objeto

Regla en el mapper, en una función pura `itemPrice(json)`:

1. `typeof json.cost === 'number'` → `json.cost` (compatibilidad; conserva `0`).
2. Si no, recorre `json.prices ?? []` y devuelve el `purchase_price` de la **última** entrada con `currency.name === 'poke-dollar'` y `purchase_price > 0`. La última corresponde al juego más reciente que PokéAPI tiene en la lista; es una elección simple y estable, no un orden cronológico garantizado.
3. Si no hay ninguna → `null`.

Golden: `site/js/mappers/fixtures/item-ultra-ball.json`, capturado de `https://pokeapi.co/api/v2/item/ultra-ball` y recortado a los campos que el mapper lee (`id`, `name`, `category`, `sprites`, `effect_entries` en inglés, `prices` completo). Los tests existentes con `item.json` (master-ball) se mantienen. Entradas: particiones (cost número / cost ausente; prices vacío / ausente / con válidas / sin válidas), límites (`purchase_price` 0, 1, `null`; `cost` 0), adivinación de errores (moneda distinta en la última posición, `currency` sin nombre esperado, una sola entrada válida al principio).

El MCP no cambia de código: su esquema ya admite `cost` entero o `null`, y su golden de `tools/list` no depende de valores.

### D3. Mock del e2e

`detailBody` aplica un parche mínimo por recurso y nombre: `pokemon/pikachu` recibe `types: [{ slot: 1, type: { name: 'electric', url } }]`. `TYPE_NAMES` añade `stellar` tras `fairy`, como en PokéAPI. El e2e comprueba que el diálogo de PIKACHU muestra `ELECTRIC` y que la tabla de tipos tiene 18 cabeceras de fila sin `STELLAR`.

### D4. `modulepreload` con test de grafo

Se añaden a cada HTML con `js/ui/main.js` los `<link rel="modulepreload" href="js/...">` del grafo estático completo, en orden alfabético, justo antes del `<script type="module">`. El test `site/js/module-preload.test.js` recorre el grafo desde `site/js/ui/main.js` leyendo los `import ... from '<relativa>'` estáticos (sin red ni dependencias) y compara, por página, el conjunto esperado con los `href` precargados; falla con la página, los que faltan y los que sobran. `check:html` no se ve afectado (solo compara `<header>`). La CSP (`script-src 'self'`) ya permite precargar módulos propios.

Se mide con `npm run lhci` antes y después (medianas de 3 ejecuciones por página). Si la mediana de rendimiento de alguna página baja, se revierte el cambio de HTML y el test, y se documenta.

Alternativa descartada: empaquetar con un bundler; el proyecto es estático sin build por decisión (ADR).

### D5. Dependabot

En las dos entradas `npm` (`/` y `/mcp`) se añade:

```yaml
ignore:
  - dependency-name: '@types/node'
    update-types: ['version-update:semver-major']
```

`/mcp` no declara hoy `@types/node`; se incluye igualmente para que la regla no dependa de dónde se añada en el futuro. Tras fusionar, `gh pr close 6` con un comentario en español; la rama la borra Dependabot.

### D6. Versión 1.1.1

`npm version 1.1.1 --no-git-tag-version` en la raíz (regenera `site/js/version.js`) y en `mcp/`, `mcp/server.json` a mano y entrada `[1.1.1]` con «Corregido» y «Cambiado». El test de coherencia existente valida el conjunto.

## Risks / Trade-offs

- [`prices` no está ordenado cronológicamente de forma garantizada] → Se documenta la regla «última entrada válida»; cualquier precio real es mejor que «—» para todos.
- [`modulepreload` aumenta las peticiones iniciales en páginas que no usan todos los renderizadores] → Son módulos pequeños del mismo origen; se mide y se revierte si empeora.
- [La lista de precargas puede quedar obsoleta] → El test del grafo falla en `npm test` y en CI.
- [Variabilidad de Lighthouse por la latencia real de PokéAPI] → Medianas de 3 ejecuciones y comparación con la base medida en la misma máquina.

## Migration Plan

Sin migración de datos: la caché de listas no guarda detalles de objetos, y la de detalles es por sesión. Reversión: revertir el commit correspondiente.
