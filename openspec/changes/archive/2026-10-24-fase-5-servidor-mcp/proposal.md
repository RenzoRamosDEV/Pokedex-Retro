# Propuesta: Fase 5 — servidor MCP

## Why

La Pokédex solo se puede consultar desde el navegador. Claude Desktop y Claude Code pueden usar fuentes de datos externas mediante el Model Context Protocol, y la lógica pura que necesita un servidor así (búsqueda, paginación, carga de secciones y mappers de PokéAPI) ya existe y está probada en `site/js/core` y `site/js/mappers`. Esta fase añade un servidor MCP local por stdio (ADR 0003) que la reutiliza tal cual, sin backend propio: el servidor llama directamente a PokéAPI.

## What Changes

- Paquete nuevo `mcp/` (`pokedex-retro-mcp`, Node ≥ 22, ESM, JavaScript con JSDoc y `// @ts-check` según ADR 0004) con el binario `mcp/bin/pokedex-mcp.js` y transporte stdio. Dependencias de runtime solo `@modelcontextprotocol/sdk` y `zod`, con versión exacta.
- Tools con entrada validada, `outputSchema` declarado y respuesta con texto legible + `structuredContent`:
  - `buscar_pokemon`, `buscar_movimientos`, `buscar_habilidades`, `buscar_objetos`, `buscar_bayas`: `consulta` (1–50), `pagina` (≥ 1, por defecto 1), `tamano_pagina` (1–50, por defecto 10, independiente de los tamaños de la web) → `{ resultados, pagina, total_paginas, total }`.
  - `obtener_pokemon`, `obtener_movimiento`, `obtener_habilidad`, `obtener_objeto`, `obtener_baya`: `nombre_o_id` (texto o entero ≥ 1) → la salida exacta del mapper de la web.
  - `efectividad_tipos`: `atacante` y `defensor` opcional (1 o 2 tipos) → multiplicador combinado, o los 18 multiplicadores del atacante.
  - `naturalezas`: `estadistica` opcional → naturalezas que suben o bajan esa estadística.
- Errores como resultado `isError: true` con texto accionable en español (recurso inexistente, página fuera de rango, tipo desconocido, PokéAPI caída, entrada inválida), sin romper la sesión MCP.
- Resources `pokedex://tipos/tabla` (matriz de efectividad de los 18 tipos) y `pokedex://secciones` (catálogo de secciones con tamaños de página). Prompts `comparar_pokemon(a, b)` y `equipo_contra_tipo(tipo)`.
- Cliente de PokéAPI para el servidor: `User-Agent` identificable, plazo de 10 s, 2 reintentos con espera exponencial (respetando `Retry-After` en 429), 4 peticiones simultáneas como máximo, caché en memoria de 24 h y caché en disco opcional (`POKEDEX_MCP_DISK_CACHE=1`).
- Registros solo en stderr con nivel `POKEDEX_MCP_LOG` (`error` por defecto, `info`, `debug`); stdout queda reservado al protocolo. Cierre limpio con `SIGINT`/`SIGTERM` (código 0, < 2 s).
- Módulos compartidos de la web, cambios aditivos y compatibles: el cliente HTTP respeta `Retry-After`; `loadSection` devuelve también `total` y expone la carga de un único detalle; la caché de listas admite un prefijo de clave propio.
- Tests `node:test` en `mcp/test/` con `InMemoryTransport` y un `fetch` falso sobre los fixtures (sin red), más tests que lanzan el binario; mutación con Stryker sobre `mcp/src` (umbral 85 %, ≤ 180 s).
- Scripts raíz `mcp:start`, `mcp:test`, `mcp:test:mutation`, `mcp:inspect`; CI instala `mcp/`, ejecuta sus tests en ambas versiones de Node y su mutación en Node 24; `tsconfig.json` incluye `mcp/src`; Dependabot vigila `/mcp`.
- `mcp/server.json` según el esquema del registro MCP (`io.github.renzoramosdev/pokedex-retro`, stdio) y `mcp/README.md` en español.

Fuera de alcance: publicar el paquete en npm o enviarlo al registro MCP (solo se deja `server.json` listo); transporte HTTP o SSE; autenticación; despliegue en la nube; registrar el servidor en la configuración de Claude del equipo local.

## Capabilities

### New Capabilities

- `servidor-mcp`: servidor MCP local por stdio sobre PokéAPI: catálogo de tools, resources y prompts, contratos de entrada y salida, errores accionables, cliente de PokéAPI con caché y reintentos, higiene de stdout, registros, cierre limpio y metadatos del paquete.

### Modified Capabilities

- `cliente-http`: los reintentos ante 429 esperan lo indicado por `Retry-After` cuando la cabecera es válida.
- `calidad-codigo`: el typecheck cubre `mcp/src`; nueva mutación de `mcp/src` (≥ 85 %, ≤ 180 s); el cierre de fase exige ≥ 586 tests, `mcp:test` y `mcp:test:mutation`.
- `integracion-continua`: el CI instala `mcp/` y ejecuta `mcp:test` (Node 22 y 24) y la mutación del MCP (Node 24); Dependabot revisa también `/mcp`.

## Impact

- **Ficheros nuevos**: `mcp/package.json`, `mcp/package-lock.json`, `mcp/server.json`, `mcp/README.md`, `mcp/bin/pokedex-mcp.js`, `mcp/src/**/*.js`, `mcp/test/**` (tests, `fetch` falso y fixture de la tabla de tipos), `stryker.mcp.config.json`.
- **Ficheros modificados**: `site/js/api/client.js`, `site/js/api/cache.js`, `site/js/core/load-section.js` y sus tests; `package.json`, `tsconfig.json`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `README.md`, `CONTRIBUTING.md`.
- **Contratos de la web**: solo se añaden campos y exportaciones; la web no cambia de comportamiento salvo la espera de `Retry-After` en 429 (si el navegador expone la cabecera).
- **Dependencias nuevas**: runtime de `mcp/`: `@modelcontextprotocol/sdk` y `zod` (previstas en el plan); `@modelcontextprotocol/inspector` solo vía `npx`, sin instalar. La raíz no gana dependencias.
- **Red**: los tests no usan red; el servidor en uso real llama a `https://pokeapi.co/api/v2`.
