# Diseño: Fase 5 — servidor MCP

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: ver `specs/`. Decisiones de arquitectura previas: ADR 0003 (stdio) y ADR 0004 (JavaScript + JSDoc + `// @ts-check`, sin build).

Estado observado en `main` (fase 4 fusionada, 586 tests en verde):

- `site/js/core/load-section.js`: `loadSection(fetchJson, config, parsedQuery)` con el puerto `fetchJson(url) → Promise<{ ok, status, json }>`. Con `query` pide la lista completa `…/<recurso>?limit=100000`, filtra con `filterByName` y pagina con `sliceFor`/`totalPages`; sin `query`, pide `?limit=<pageSize>&offset=<n>`; sin paginar (`pageSize: null`), `?limit=<listLimit>`. Carga los detalles con `createLimit(6)` y `Promise.allSettled`. Devuelve `{ status: 'error' }` si falla la lista, o `{ status: 'ok', items (orden por id), page, totalPages, rawQuery, failedCount }`. **No devuelve el total de coincidencias** y `fetchDetail(fetchJson, config, name)` es privada: propaga el rechazo del puerto (incluido un error con `status` 404).
- `site/js/core/sections.js`: `SECTIONS` con `resource`, `pageSize` (18, 16, 12, 15, 8; `null` en `naturalezas` y `tipos`), `listLimit`, `mapper`, `exclude` (`tipos` excluye `unknown` y `shadow`).
- `site/js/core/search.js`: `normalizeQuery` (trim, minúsculas, espacios por `-`, vacío → `null`) y `filterByName` (subcadena).
- `site/js/core/limit.js`: `createLimit(max)` genérico y puro.
- `site/js/mappers/*.js`: `mapPokemon`, `mapMove`, `mapAbility`, `mapItem`, `mapBerry`, `mapNature`, `mapType`; `effectiveness(attacker, defenderName)` devuelve `'2x' | 'half' | '0' | '1'`.
- `site/js/api/client.js`: `createFetchJson({ fetch, cache, timeoutMs = 10000, retries = 2 })`, puro y con `fetch` inyectable: plazo total por llamada (esperas incluidas), reintentos ante `TypeError`, 429 y 5xx con `500 ms × 2^intento`, `HttpError` con `status`, caché `{ get, set }` opcional. **No lee `Retry-After`** y no permite cabeceras propias (el `init` que pasa a `fetch` solo lleva `signal`).
- `site/js/api/cache.js`: `createListCache({ storage, now, ttlMs })` guarda `{ t, data }` en un `StorageLike` síncrono (`getItem`/`setItem` de cadenas) con TTL y tolera fallos; prefijo de clave fijo `pokedex:lista:`.
- `site/js/ui/main.js` adapta el cliente al puerto de `loadSection`: `(url) => fetchJson(url, { signal }).then((json) => ({ ok: true, status: 200, json }))`.
- PokéAPI real (consultada el 2026-10-24): `type?limit=100` devuelve 21 tipos: los 18 clásicos, `stellar` (id 19, sin relaciones de daño) y `unknown`/`shadow`. `SECTIONS.tipos` solo excluye estos dos, así que la web muestra hoy 19 filas; el MCP necesita los 18 de la tabla de daño. `nature?limit=100` devuelve 25.
- Fixtures (`site/js/mappers/fixtures/`): un JSON por recurso: gengar #94, thunderbolt #85, adamant #11, master-ball #1, cheri #1, ghost #8, stench #1. Solo hay un tipo y una naturaleza reales.
- Herramientas: raíz `type: module` (los `.js` de `site/` son ESM para Node), Stryker 10 con `commandRunner`, `tsc` 7.0.2, ESLint ya declara globales de Node para `mcp/**/*.js`; `.gitignore` y `.prettierignore` ya ignoran `node_modules/` y `package-lock.json` en cualquier nivel.
- Comprobado en un directorio temporal con el SDK real (ver D1): invalid input → resultado `isError` (no excepción); `structuredContent` validado por el servidor contra `outputSchema`; prompt sin argumento obligatorio → error JSON-RPC `-32602`; el proceso termina solo al cerrarse stdin; `inspector --cli` funciona con `--method tools/list` y `tools/call --tool-name … --tool-arg k=v`.

## Goals / Non-Goals

**Goals:**

- Un único camino de datos: el MCP usa `loadSection`, `fetchDetail`, `SECTIONS`, mappers, `createLimit`, `createFetchJson` y `createListCache` de la web; en `mcp/src` solo hay adaptadores (proceso, disco, MCP) y la traducción a contratos de tool.
- Dominio sin dependencias de infraestructura: `core`/`mappers` siguen sin saber nada de MCP, Node ni disco; los cambios en módulos compartidos son aditivos.
- Tests rápidos y sin red: servidor en memoria con un `fetch` falso; el binario solo se lanza para stdout, señales y una sesión stdio completa.

**Non-Goals:**

- Paquete publicable en npm (ver D4), transporte HTTP, autenticación, `resources/subscribe` o notificaciones `listChanged`, LRU o límite de tamaño de la caché en memoria, traducción de nombres de tipo o estadística al español.

## Decisions

### D1. Versiones fijadas y API del SDK verificada

| Paquete | Versión exacta | Dónde | Motivo |
| --- | --- | --- | --- |
| `@modelcontextprotocol/sdk` | `1.32.2` | `mcp/` runtime | Última 1.x estable en npm (`latest`, publicada 2026-10-23); `engines.node >=18` |
| `zod` | `4.6.7` | `mcp/` runtime | El SDK declara `zod: ^3.25 \|\| ^4.0` como dependencia y peer; se usa v4 (actual `latest`), verificada con `registerTool` |
| `@modelcontextprotocol/inspector` | `2.12.0` | solo `npx` | `mcp:inspect` y verificación con `--cli` |

Se instalan con `npm i --save-exact --prefix mcp @modelcontextprotocol/sdk@1.32.2 zod@4.6.7`. API usada (rutas de importación comprobadas en el paquete instalado):

- `McpServer` de `@modelcontextprotocol/sdk/server/mcp.js`: `registerTool(nombre, { title?, description, inputSchema: <shape zod>, outputSchema: <shape zod> }, handler)`; el handler devuelve `{ content: [{ type: 'text', text }], structuredContent }` o `{ content, isError: true }` (sin `structuredContent`, permitido aunque haya `outputSchema`). `registerResource(nombre, uri, { title, description, mimeType }, (uri) => ({ contents: [{ uri: uri.href, mimeType, text }] }))`. `registerPrompt(nombre, { title, description, argsSchema: <shape zod> }, (args) => ({ messages: [{ role: 'user', content: { type: 'text', text } }] }))`. `server.connect(transport)`, `server.close()`.
- `StdioServerTransport` de `@modelcontextprotocol/sdk/server/stdio.js`.
- Tests: `InMemoryTransport.createLinkedPair()` de `@modelcontextprotocol/sdk/inMemory.js`; `Client` de `@modelcontextprotocol/sdk/client/index.js` (`listTools`, `callTool`, `listResources`, `readResource`, `listPrompts`, `getPrompt`); `StdioClientTransport` de `@modelcontextprotocol/sdk/client/stdio.js`.
- Comportamiento observado: una entrada inválida produce `isError: true` con texto `MCP error -32602: Input validation error: Invalid arguments for tool <tool>: <mensaje zod> at <campo>`; el prefijo lo pone el SDK, por eso la spec exige que el texto **contenga** el mensaje del campo. `inputSchema`/`outputSchema` se publican como JSON Schema draft-07 (`minLength`, `maximum`, `default`, `anyOf`…), lo que también orienta al modelo. Un `structuredContent` que no cumple el esquema se convierte en `isError` con `Output validation error`, así que un desajuste mapper/esquema rompe los tests.
- `tsc` 7.0.2 comprueba sin errores un módulo `// @ts-check` que usa `registerTool` con shapes de zod 4 (≈ 3 s).

### D2. Estructura de `mcp/` y responsabilidades

```
mcp/
├── package.json · package-lock.json · server.json · README.md
├── bin/pokedex-mcp.js        adaptador de proceso: versión, entorno, stdio, señales
├── src/
│   ├── log.js                createLogger({ level, write })
│   ├── disk-storage.js       createDiskStorage({ dir, log }) → StorageLike síncrono por SHA-256
│   ├── client.js             createPokeApiClient({ fetch, env, homedir, now, log, version }) → { port }
│   ├── results.js            okResult(resumen, datos), errorResult(texto), MENSAJES
│   ├── schemas.js            shapes zod de entrada (con mensajes) y de salida (forma de los mappers)
│   ├── type-chart.js         loadTypeChart(port) → { names, multiplier(atacante, defensor) }
│   ├── tools/catalogo.js     buscar_* y obtener_* a partir de la tabla de D6
│   ├── tools/efectividad.js  efectividad_tipos
│   ├── tools/naturalezas.js  naturalezas
│   ├── resources/tipos.js · resources/secciones.js
│   ├── prompts/comparar-pokemon.js · prompts/equipo-contra-tipo.js
│   ├── server.js             createServer({ port, log, version }) → McpServer con todo registrado
│   └── lifecycle.js          installShutdown({ target, close, exit, log, graceMs })
└── test/                     ver D11
```

Dependencias en una sola dirección: `bin` → `server` → `tools|resources|prompts` → `results|schemas|type-chart` → `site/js/core|mappers`; `bin` → `client` → `site/js/api` + `site/js/core/limit.js` + `disk-storage`. Las tools solo conocen el **puerto** `port(url) → Promise<{ ok, status, json }>` (el mismo contrato que `loadSection`), nunca `fetch`, disco ni entorno. `createServer` es la exportación pública (`exports: { ".": "./src/server.js" }`) y recibe el puerto inyectado, lo que permite los tests en memoria.

### D3. Reutilización de los módulos compartidos

Importación por ruta relativa desde `mcp/src` (`../../site/js/…`, o `../../../site/js/…` desde subcarpetas). Node los carga como ESM por el `type: module` de la raíz.

| Módulo compartido | Uso en el MCP |
| --- | --- |
| `core/sections.js` (`SECTIONS`) | Config por sección; las búsquedas usan `{ ...SECTIONS[clave], pageSize: tamano_pagina }`; resource `pokedex://secciones` |
| `core/search.js` (`normalizeQuery`) | Normaliza `consulta` y `nombre_o_id` de texto |
| `core/load-section.js` (`loadSection`, `fetchDetail`) | `buscar_*` (camino con `query`), `naturalezas` y la tabla de tipos (sin paginar); `obtener_*` con `fetchDetail` |
| `core/pagination.js` | Indirecto, dentro de `loadSection` (`sliceFor`, `totalPages`); importarlo directamente sería código muerto |
| `core/limit.js` (`createLimit`) | Máximo 4 peticiones simultáneas (D5) |
| `mappers/*` | Vía `SECTIONS[clave].mapper`; `effectiveness` de `mappers/type.js` para los multiplicadores |
| `api/client.js` (`createFetchJson`) | Plazo, reintentos, backoff, `Retry-After`, caché |
| `api/cache.js` (`createListCache`) | Sobre de TTL `{ t, data }` para la memoria y el disco |

Cambios aditivos en módulos compartidos (cada uno con TDD en sus tests de `site/` y mutación del diff > 95 %):

1. `load-section.js`: `export` en `fetchDetail` (sin cambiar su cuerpo) y campo `total` en el resultado `ok`: número de entradas de la lista tras filtrar por la consulta y antes de `exclude` (`count` en el camino paginado sin consulta, `matches.length` con consulta, `entries.length` sin paginar). La web lo ignora.
2. `client.js`: `ResponseLike` gana `headers?: { get(name: string): string | null }` y `createFetchJson` acepta `now = Date.now`. En un 429, `retryAfterMs(headers, now)` interpreta `^\d+$` como segundos y si no `Date.parse` (fecha HTTP) con `max(0, fecha - now())`; cualquier otro valor → `null`. La espera es `retryAfterMs ?? 500 × 2^intento`; 5xx y red siguen con la exponencial. La espera usa el mismo `waitBackoff` (respeta plazo y cancelación).
3. `cache.js`: `createListCache({ storage, now, ttlMs, prefix = 'pokedex:lista:' })`. El MCP pasa `prefix: ''` para que la clave sea la URL y el fichero en disco sea literalmente el SHA-256 de la URL.

Alternativa descartada: copiar reintentos, TTL y concurrencia en `mcp/src` (rompe la regla de no duplicar y deja dos implementaciones del mismo contrato de PokéAPI).

### D4. `files` del paquete y publicación

npm no admite en `files` rutas fuera del directorio del paquete, así que `npm pack` de `mcp/` nunca incluiría `site/js`. Decisión mínima y honesta:

- `files: ["bin", "src"]` y `"private": true`: el paquete se ejecuta desde un clon del repositorio (como indican `mcp/README.md` y la config de Claude) y npm rechaza un `npm publish` accidental de un tarball roto.
- `mcp/README.md` (sección Limitaciones) y este diseño dejan escrito que publicar exigirá empaquetar los módulos compartidos (p. ej. copiarlos en `prepack` o convertir `site/js` en paquete) y quitar `private`; queda para una fase futura, igual que el envío de `server.json` al registro.
- Alternativas descartadas: paquete de workspace para `site/js` (cambia la estructura de la web publicada sin build); script `prepack` que copie y reescriba importaciones (código de publicación fuera de alcance); enlaces simbólicos (npm no los empaqueta de forma fiable y fallan en Windows).

Resto de `mcp/package.json`: `name` `pokedex-retro-mcp`, `version` `1.0.0` (= raíz), `description`, `license` `MIT`, `type` `module`, `bin` `{ "pokedex-retro-mcp": "bin/pokedex-mcp.js" }`, `exports` `{ ".": "./src/server.js" }`, `engines` `{ "node": ">=22" }`, `mcpName` `io.github.renzoramosdev/pokedex-retro` (campo que el registro usa para verificar el paquete npm), `repository` `{ type: git, url, directory: "mcp" }`, `dependencies` exactas de D1, sin `devDependencies` ni `scripts` (Stryker, ESLint, Prettier y `tsc` vienen de la raíz). El bin lleva `#!/usr/bin/env node` y bit de ejecución (`git update-index --chmod=+x`).

### D5. Cliente de PokéAPI del servidor (`client.js`)

```
tool ──port(url)──▶ limit(4) ──▶ fetchJson  (api/client.js: caché, plazo 10 s, 2 reintentos, Retry-After)
                                   │ cache = escalonada(memoria, disco?)
                                   └ fetch = (url, init) => globalThis.fetch(url, { ...init, headers: { 'User-Agent': UA } })
port(url) = limit(() => fetchJson(url)).then((json) => ({ ok: true, status: 200, json }))
```

- `UA = pokedex-retro-mcp/<version> (+https://github.com/RenzoRamosDEV/Pokedex-Retro)`; `version` la lee el bin de `mcp/package.json` con `readFileSync` + `JSON.parse` (sin `import … with { type: 'json' }` para no depender de avisos experimentales en Node 22) y se pasa a cliente y servidor.
- `createLimit(4)` envuelve **la llamada completa** a `fetchJson`, no cada intento: el plazo de 10 s empieza al obtener hueco (una cola larga no agota plazos) y las esperas entre reintentos ocupan hueco (más respetuoso con PokéAPI). Los aciertos de caché también pasan por la cola; su coste es despreciable. `loadSection` mantiene su `createLimit(6)` interno; el límite efectivo es 4.
- `fetch` se resuelve en `globalThis.fetch` en cada llamada, así un `--import` de test puede sustituirlo en el binario. Cada intento registra `debug` `GET <url>`.
- Caché escalonada: `memoria = createListCache({ storage: mapStorage(), prefix: '', now })` (un `Map` de cadenas JSON con `getItem`/`setItem`); `disco = createListCache({ storage: createDiskStorage({ dir, log }), prefix: '', now })` solo si `env.POKEDEX_MCP_DISK_CACHE === '1'`. `get(url)`: memoria y, si falla, disco (registra `debug` `caché <url>` en un acierto); `set`: ambas. Sin promoción de disco a memoria, para no reiniciar el TTL de una entrada.
- Directorio: `join(env.XDG_CACHE_HOME, 'pokedex-mcp')` si `XDG_CACHE_HOME` es absoluta (la especificación XDG ignora rutas relativas), si no `join(homedir(), '.cache', 'pokedex-mcp')`.
- `createDiskStorage`: fichero `<dir>/<sha256hex(clave)>.json` (`node:crypto` `createHash('sha256')`); `getItem` con `readFileSync` → `ENOENT` devuelve `null` sin registro, otro error → `log.error('caché en disco: …')` y `null`; `setItem` con `mkdirSync(dir, { recursive: true })` + `writeFileSync`, error → `log.error` y se ignora. Nunca lanza (`createListCache` se tragaría la excepción sin registrarla). JSON corrupto o sobre inválido: `createListCache` lo trata como fallo y se sobrescribe.
- E/S síncrona: aceptable para un proceso local con caché opcional; evita convertir `createListCache` en asíncrona (cambio de contrato en la web).

### D6. Tools

Tabla de catálogo (`tools/catalogo.js`), una fila por sección:

| Clave `SECTIONS` | Buscar | Obtener | Recurso en el error | Resumen de detalle |
| --- | --- | --- | --- | --- |
| `pokedex` | `buscar_pokemon` | `obtener_pokemon` | `el Pokémon` | `Pokémon <name> (#<id>).` |
| `movimientos` | `buscar_movimientos` | `obtener_movimiento` | `el movimiento` | `Movimiento <name> (#<id>).` |
| `habilidades` | `buscar_habilidades` | `obtener_habilidad` | `la habilidad` | `Habilidad <name> (#<id>).` |
| `objetos` | `buscar_objetos` | `obtener_objeto` | `el objeto` | `Objeto <name> (#<id>).` |
| `bayas` | `buscar_bayas` | `obtener_baya` | `la baya` | `Baya <name> (#<id>).` |

- `buscar_*`: `q = normalizeQuery(consulta)`; `r = await loadSection(port, { ...SECTIONS[clave], pageSize: tamano_pagina }, { page: pagina, query: q, rawQuery: consulta })`. Orden de comprobación: `r.status === 'error'` → caída; `pagina > 1 && pagina > r.totalPages` → página fuera de rango; `r.items.length === 0 && r.failedCount > 0` → caída; si no, `{ resultados: r.items, pagina: r.page, total_paginas: r.totalPages, total: r.total }`. La lista completa (`?limit=100000`) se pide una vez por sección y día gracias a la caché. Resumen: `<total> resultados para "<q>" · página <p> de <t>.` (`1 resultado`; `Sin resultados para "<q>".` con total 0) y, con fallos, ` <n> no se pudieron cargar.` (`1 no se pudo cargar.`).
- `obtener_*`: `slug = typeof v === 'number' ? String(v) : normalizeQuery(v)`; `fetchDetail(port, SECTIONS[clave], slug)`; un rechazo con `status === 404` → recurso inexistente con `"<slug>"`; cualquier otro rechazo → caída.
- `efectividad_tipos` (`tools/efectividad.js` + `type-chart.js`): `loadTypeChart(port)` usa `loadSection(port, { ...SECTIONS.tipos, exclude: [...SECTIONS.tipos.exclude, 'stellar'] }, { page: 1, query: null, rawQuery: null })` → 18 tipos mapeados en orden de id (`stellar` se excluye en el MCP y no en `SECTIONS` para no cambiar la web en esta fase; ni siquiera se pide su detalle); `status: 'error'` o `failedCount > 0` → caída (una tabla incompleta daría multiplicadores falsos). Se valida `atacante` y luego cada `defensor` contra `names` → tipo desconocido. `MULTIPLICADOR = { '2x': 2, half: 0.5, '0': 0, '1': 1 }` aplicado a `effectiveness(atacante, defensor)`; con defensor, producto; sin defensor, objeto con los 18 en orden de id. Resumen `electric contra water/flying: ×4.` o `Multiplicadores de fire contra los 18 tipos.`
- `naturalezas`: `loadSection(port, SECTIONS.naturalezas, { page: 1, query: null, rawQuery: null })`; error o `failedCount > 0` → caída; filtro `increasedStat === e || decreasedStat === e`. Resumen `<n> naturalezas que suben o bajan <e>.` o `<n> naturalezas.`
- Texto de toda respuesta correcta: `<resumen>\n\n<JSON.stringify(structuredContent, null, 2)>` (`okResult`). Cada handler registra `info` `tool <nombre>`.
- Esquemas de salida (`schemas.js`): shapes zod con exactamente los campos de cada mapper; nulos donde el mapper usa `?? null` (`baseExperience`, `sprite`, `accuracy`, `power`, `cost`, `increasedStat`…) y `pp` también nulo (PokéAPI lo da `null` en algunos movimientos). Envoltorios en español: `{ resultados: z.array(...), pagina, total_paginas, total }`, `{ atacante, defensor, multiplicador }`/`{ atacante, multiplicadores: z.record(z.string(), z.number()) }` (dos tools no pueden compartir un único `outputSchema` con forma distinta, así que `efectividad_tipos` declara `defensor` y `multiplicador` opcionales y `multiplicadores` opcional), `{ naturalezas: z.array(...) }`.

Esquemas de entrada; cada comprobación del campo usa el mismo mensaje con el parámetro `error` de zod 4, también el tipo base (`z.number({ error })`) y **cada comprobación de cada rama** de `nombre_o_id` (comprobado: zod 4 informa el fallo de la rama más cercana e ignora el `error` del `union`):

| Campo | Esquema | Mensaje |
| --- | --- | --- |
| `consulta` | `string().trim().min(1).max(50)` | `consulta debe tener entre 1 y 50 caracteres.` |
| `pagina` | `number().int().min(1).default(1)` | `pagina debe ser un entero mayor o igual que 1.` |
| `tamano_pagina` | `number().int().min(1).max(50).default(10)` | `tamano_pagina debe estar entre 1 y 50.` |
| `nombre_o_id` | `union([string().trim().min(1).max(50).regex(/^[A-Za-z0-9 -]+$/), number().int().min(1)])` | `nombre_o_id debe ser un nombre (letras, números, espacios o guiones) o un entero mayor o igual que 1.` |
| `atacante` | `string().trim().toLowerCase().min(1).max(20)` | `atacante debe ser un nombre de tipo de PokéAPI, p. ej. fire.` |
| `defensor` | `array(<como atacante>).min(1).max(2)` + `refine` de distintos, opcional | `defensor debe tener 1 o 2 tipos distintos.` |
| `estadistica` | `enum(['attack', 'defense', 'special-attack', 'special-defense', 'speed'])`, opcional | `estadistica debe ser attack, defense, special-attack, special-defense o speed.` |

La expresión de `nombre_o_id` impide que el texto escape de la ruta (`../item/1`, `?`, `/`, `#`) al interpolarse en `fetchDetail`; los nombres de PokéAPI son siempre `[a-z0-9-]`. `atacante` y `defensor` son texto libre (no `enum`) para poder responder con la lista de tipos válidos.

### D7. Errores

`results.js` centraliza los textos exactos de `specs/servidor-mcp` («Página fuera de rango», «Recurso inexistente», «Tipo desconocido», «PokéAPI no disponible») y `errorResult(texto) = { content: [{ type: 'text', text }], isError: true }`. Las tools solo envuelven en `try/catch` las llamadas a PokéAPI; un error de programación se deja al SDK, que lo convierte en `isError` sin cerrar la sesión. Toda caída se registra con `error` (`tool <nombre>: <name> <status?>`). La entrada inválida la responde el SDK antes de llamar al handler (D1), por eso no hay petición.

### D8. Resources y prompts

- `pokedex://tipos/tabla` (nombre `tabla-tipos`, título `Tabla de tipos`, `application/json`): `JSON.stringify({ tipos: names, multiplicadores: { <atacante>: { <defensor>: n } } })` desde `loadTypeChart`. Si PokéAPI cae, el handler lanza `Error('PokéAPI no responde; inténtalo en unos minutos.')` y el SDK responde un error JSON-RPC con ese texto (los resources no tienen `isError`).
- `pokedex://secciones` (nombre `secciones`, título `Secciones de la Pokédex`): `{ secciones: Object.entries(SECTIONS).map(([clave, s]) => ({ clave, recurso: s.resource, tamano_pagina: s.pageSize })) }`, sin red.
- `comparar_pokemon` (`argsSchema: { a, b }`, cada uno `string().trim().min(1).max(50)`), texto exacto: `Compara los Pokémon "<a>" y "<b>". Usa obtener_pokemon con cada uno para conocer sus tipos, estadísticas base y habilidades, y efectividad_tipos para ver cómo se atacan entre sí. Resume en español quién tiene ventaja y por qué. Si alguno no existe, usa buscar_pokemon para encontrar el nombre exacto.`
- `equipo_contra_tipo` (`argsSchema: { tipo }`), texto exacto: `Propón un equipo de 6 Pokémon para enfrentarse a rivales de tipo "<tipo>". Usa efectividad_tipos para saber qué tipos le hacen daño ×2 y cuáles resisten sus ataques, y buscar_pokemon y obtener_pokemon para elegir Pokémon de esos tipos y comprobar sus estadísticas. Explica en español por qué eliges cada uno. Los tipos van en inglés, como en PokéAPI (p. ej. fire).`

### D9. Registros y stdout

- `createLogger({ level, write })`: niveles `error` < `info` < `debug`; valor ausente o desconocido → `error`; línea `[pokedex-mcp] <nivel>: <mensaje>\n` con `write` inyectado (el bin pasa `(s) => process.stderr.write(s)`).
- `info`: `servidor iniciado (v<versión>)`, `cerrando por <señal>`, `tool <nombre>`. `debug`: `GET <url>` y `caché <url>`. `error`: caídas de PokéAPI y fallos de disco.
- Guarda estática: ESLint añade `no-console: error` para `mcp/src/**/*.js` y `mcp/bin/**/*.js`; ningún módulo escribe en `process.stdout`. El único escritor de stdout es `StdioServerTransport`.

### D10. Ciclo de vida

- Bin: lee la versión, crea logger, cliente y servidor, `await server.connect(new StdioServerTransport())`, registra `info` de arranque e `installShutdown({ target: process, close: () => server.close(), exit: (code) => process.exit(code), log, graceMs: 1500 })`.
- `installShutdown`: escucha `SIGINT` y `SIGTERM` una sola vez; registra `info`, arma `setTimeout(() => exit(0), graceMs)` como salida forzada y ejecuta `close()`; tanto si resuelve como si rechaza (rechazo → `log.error`), cancela el temporizador y llama a `exit(0)`. Una segunda señal no repite el cierre. Con 1,5 s de gracia el proceso queda por debajo de 2 s aunque `close()` se cuelgue.
- Cierre de stdin: el SDK deja de leer y el proceso termina solo (comprobado); no se añade lógica.

### D11. Tests

```
mcp/test/
├── support/pokeapi-falsa.js        createFakePokeApi({ respuestas }) → { fetch, calls }
├── support/preload-pokeapi-falsa.js  globalThis.fetch = createFakePokeApi().fetch  (para --import)
├── support/conectar.js             createServer + InMemoryTransport + Client → { client, calls, logs }
├── fixtures/tipos.json             21 tipos reales de PokéAPI (incluye stellar, unknown y shadow)
├── fixtures/naturalezas.json       25 naturalezas reales de PokéAPI
├── log.test.js · disk-storage.test.js · client.test.js · lifecycle.test.js · package.test.js
├── catalogo.test.js · efectividad.test.js · naturalezas.test.js · server.test.js
├── resources.test.js · prompts.test.js
└── bin/stdout.test.js · bin/senales.test.js · bin/stdio-client.test.js
```

- PokéAPI falsa: listas `…/<recurso>?limit=<n>[&offset=<m>]` con `{ count, results: [{ name, url }] }` a partir de un catálogo de nombres (Pokémon: 40 con `pikachu` en el 25, más 12 nombres que contienen `char` para la paginación, y `gengar` en el 94); detalles por nombre o id clonando el fixture de la web con `{ ...fixture, id, name }`; tipos y naturalezas desde los fixtures de `mcp/test/fixtures`; respuestas guionizadas por URL (`status`, cabeceras con `new Headers(...)`, cuerpo, `'hang'`) para 404, 429/`Retry-After`, 503 y cuelgues; registro de URL y cabeceras de cada llamada. Cualquier URL que no sea `https://pokeapi.co/api/v2/…` hace fallar el test.
- Fixtures nuevos capturados una sola vez de PokéAPI real (comando en tasks.md) y reducidos a `id`, `name`, `damage_relations` (tipos) o `id`, `name`, `increased_stat`, `decreased_stat`, `likes_flavor`, `hates_flavor` (naturalezas); se formatean con Prettier y se versionan. Son la única fuente de verdad de la matriz 18 × 18 en los tests (`electric`→`ground` 0, `fire`→`grass` 2…).
- Tiempo: los tests de espera (backoff, `Retry-After`, TTL) usan `t.mock.timers` (`setTimeout`) y `now` inyectado, como `site/js/api/client.test.js`; ningún fichero tarda más de 2 s salvo `bin/*.test.js` (procesos reales, ≤ 5 s cada uno).
- Validación de salida: `server.test.js` llama a cada tool y comprueba `structuredContent` con `z.object(shape).strict().parse` sobre los shapes exportados por `schemas.js` y con `deepEqual` frente al mapper aplicado al fixture; además el `Client` del SDK valida contra el `outputSchema` anunciado.
- Binario: `spawn(process.execPath, ['--import', <preload>, 'mcp/bin/pokedex-mcp.js'], { env: { …, POKEDEX_MCP_LOG: 'debug' } })`; `stdout.test.js` envía `initialize`, `notifications/initialized` y `tools/call buscar_pokemon` como líneas JSON y comprueba que **cada** línea de stdout es JSON-RPC 2.0 (`jsonrpc: '2.0'` y `id` o `method`) y que stderr contiene `debug`; `senales.test.js` envía `SIGTERM` y `SIGINT` (un proceso cada uno) tras `initialize` y mide código 0 en < 2 s; `stdio-client.test.js` usa `Client` + `StdioClientTransport` (mismos `args`) para `listTools` y `efectividad_tipos` `electric` vs `["water","flying"]` → 4.
- `package.test.js`: campos de `mcp/package.json` (D4), dependencias exactas y solo dos, versión de `server.json` y de `packages[0].version` iguales a la del paquete, nombre con `^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$`, `description` ≤ 100 caracteres, transporte `stdio`, shebang del bin.

### D12. Mutación de `mcp/src`

`stryker.mcp.config.json` (raíz):

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "command",
  "commandRunner": { "command": "node --test \"mcp/test/*.test.js\"" },
  "mutate": ["mcp/src/**/*.js"],
  "ignorePatterns": ["tsconfig.json"],
  "thresholds": { "high": 90, "low": 85, "break": 85 },
  "reporters": ["clear-text", "progress"],
  "timeoutMS": 10000
}
```

- El comando excluye `mcp/test/bin/` (procesos reales, lentos y sin código de `mcp/src` que no cubran ya los tests en memoria) para caber en 180 s.
- El sandbox de Stryker no copia `node_modules`, pero enlaza todos los `node_modules` del proyecto, también `mcp/node_modules` (comprobado en `@stryker-mutator/core` 10: `findNodeModulesList` recorre subdirectorios), así que el SDK se resuelve dentro del sandbox. Requiere `npm ci --prefix mcp` antes.
- Si la primera medición supera 180 s: dividir en `stryker.mcp.config.json` (`mcp/src/tools/**`, `resources/**`, `prompts/**`) y `stryker.mcp-base.config.json` (resto), y `mcp:test:mutation` las encadena como `test:mutation:ui`.

### D13. Herramientas, CI y metadatos

- Scripts raíz: `"mcp:start": "node mcp/bin/pokedex-mcp.js"`, `"mcp:test": "node --test \"mcp/test/**/*.test.js\""`, `"mcp:test:mutation": "timeout 180 stryker run stryker.mcp.config.json"`, `"mcp:inspect": "npx @modelcontextprotocol/inspector@2.12.0 node mcp/bin/pokedex-mcp.js"` (versión fijada para que la depuración sea reproducible; Dependabot no ve `npx`, se actualiza a mano). `npm test` no cambia de glob: los tests del MCP van por `mcp:test`.
- `tsconfig.json`: `include` añade `"mcp/src/**/*.js"`; `mcp/test` y `mcp/bin` quedan fuera (como los tests de la web). Requiere `mcp/node_modules` para resolver el SDK.
- `ci.yml`: `setup-node` con `cache-dependency-path` `package-lock.json` y `mcp/package-lock.json`; `npm ci --prefix mcp` justo después de `npm ci` (antes de `typecheck`); `npm run mcp:test` tras `npm test` en ambas versiones; `npm run mcp:test:mutation` tras `test:mutation:ui` con `if: matrix.node == 24`; `timeout-minutes: 30` (añade hasta 3 min de mutación). Sin secretos; `permissions: contents: read` intacto.
- `dependabot.yml`: entrada `npm` con `directory: /mcp`, semanal, `prefix: chore`, `include: scope`.
- `mcp/server.json`:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.renzoramosdev/pokedex-retro",
  "title": "Pokédex Retro",
  "description": "Consulta Pokémon, movimientos, habilidades, objetos, bayas, tipos y naturalezas de PokéAPI",
  "version": "1.0.0",
  "repository": { "url": "https://github.com/RenzoRamosDEV/Pokedex-Retro", "source": "github", "subfolder": "mcp" },
  "packages": [
    {
      "registryType": "npm",
      "identifier": "pokedex-retro-mcp",
      "version": "1.0.0",
      "transport": { "type": "stdio" },
      "environmentVariables": [
        { "name": "POKEDEX_MCP_LOG", "description": "Nivel de registro en stderr", "isRequired": false, "default": "error", "choices": ["error", "info", "debug"] },
        { "name": "POKEDEX_MCP_DISK_CACHE", "description": "Con 1 guarda las respuestas de PokéAPI en disco 24 h", "isRequired": false, "choices": ["1"] }
      ]
    }
  ]
}
```

  Esquema vigente comprobado (`2025-12-11`: `name`, `description` ≤ 100 y `version` obligatorios; paquete con `registryType`, `identifier`, `transport`). La fase 6 sube las tres versiones a la vez.
- Documentación: `mcp/README.md` en español nace en el grupo del paquete y cada grupo añade sus filas (tools, resources, prompts, variables); el último grupo de documentación añade la configuración de Claude Desktop (`claude_desktop_config.json` con `command: "node"` y `args` con la ruta absoluta al bin), `claude mcp add pokedex-retro -- node /ruta/a/Pokedex-Retro/mcp/bin/pokedex-mcp.js`, limitaciones y la sección MCP del `README.md` raíz. `CONTRIBUTING.md` y la plantilla de PR ganan `mcp:test` y `mcp:test:mutation` en su grupo.

### D14. Commits

Asuntos exactos en tasks.md; los cambios de módulos compartidos van en commits propios (`feat(api)`, `feat(core)`) antes de los del MCP para que cada commit deje la web en verde. El avance de casillas de tasks.md entra en el commit de archivo.

## Risks / Trade-offs

- [SDK 1.32.2 publicado hace un día] → versión exacta, verificada en local con la API usada; si la implementación encuentra una regresión, fijar `1.32.1` y anotarlo en el PR. Dependabot propone las siguientes.
- [El prefijo del error de validación lo decide el SDK] → la spec exige que el texto contenga el mensaje del campo; un cambio del SDK lo detectan los tests.
- [El navegador puede no exponer `Retry-After` por CORS] → la web cae en la espera exponencial de siempre; sin regresión.
- [`Retry-After` mayor que el plazo de 10 s] → `TimeoutError` y mensaje de caída: no se insiste contra una API que pide esperar.
- [`tamano_pagina` 50 → hasta 50 detalles por llamada] → máximo 4 simultáneas y caché de 24 h; la lista completa se pide una vez al día por sección.
- [Caché en memoria sin límite] → acotada por el número de URL distintas de PokéAPI (miles, decenas de MB en el peor caso) y por la vida del proceso; LRU fuera de alcance.
- [E/S de disco síncrona] → solo con la variable activa, ficheros pequeños; sin promoción, una lectura por acierto.
- [Paquete no publicable (`private`)] → documentado; el uso previsto es desde el clon.
- [La web muestra `stellar` (fila y columna sin efectos) y el MCP no] → divergencia consciente y documentada; alinear la web (añadir `stellar` a `SECTIONS.tipos.exclude`) es un cambio de comportamiento de la web fuera de esta fase.
- [Mutación de `mcp/src` > 180 s] → comando sin tests de binario y plan de división de D12.
- [`typecheck` y `mcp:test` necesitan `npm ci --prefix mcp`] → orden fijo en CI; `CONTRIBUTING.md` lo indica en Requisitos.

## Migration Plan

- Cambios aditivos: la web sigue igual salvo la espera de `Retry-After` en 429; ningún dato persistido cambia (el prefijo por defecto de la caché de listas es el de siempre).
- Despliegue: GitHub Pages publica solo `site/`; el MCP no se despliega. Rollback: revertir el merge; no hay estado que migrar. La caché en disco del MCP se puede borrar sin consecuencias.
