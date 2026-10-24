# Pokédex Retro

Pokédex estática con estética Game Boy sobre [PokéAPI v2](https://pokeapi.co/), sin frameworks ni build, con un servidor MCP para consultarla desde Claude.

![Demo de la Pokédex Retro](docs/media/demo.gif)

**Demo:** https://renzoramosdev.github.io/Pokedex-Retro/

## Características

- Siete secciones: Pokédex, movimientos, tipos, habilidades, naturalezas, objetos y bayas, con buscador por nombre y, salvo Tipos y Naturalezas, paginación; la búsqueda y la página van en la URL (`?q=char&page=2`).
- Ficha de cada Pokémon en un `<dialog>` nativo con enlace profundo `#pokemon-<id>`.
- Tres temas: NORMAL, DMG (verde LCD de la Game Boy) y MONO.
- Caché de listas y detalles en el navegador y como máximo 6 peticiones de detalle a la vez.
- Content Security Policy sin `'unsafe-inline'` y fuentes autoalojadas, sin Google Fonts.
- Accesibilidad WCAG 2.1 AA: navegación por teclado, región de estado y contraste en los tres temas, auditado con axe en cada página.
- Servidor MCP con 12 tools, 2 resources y 2 prompts que reutiliza la lógica de la web.

## Arquitectura

```mermaid
flowchart LR
  navegador["Navegador"] --> html["HTML<br/>site/*.html"]
  html --> ui["ui"]
  ui --> core["core / mappers"]
  claude["Claude Desktop / Claude Code"] -->|stdio| mcp["mcp"]
  mcp --> core
  core --> api["api<br/>cliente HTTP y caché"]
  api --> pokeapi[("PokéAPI v2")]
```

La web y el servidor MCP comparten `site/js/core`, `site/js/mappers` y `site/js/api`. Detalle de carpetas, flujo de una búsqueda, caché, seguridad y publicación: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Ejecutar en local

Requiere Node ≥ 22.

```bash
node scripts/serve-site.mjs
```

Abre `http://127.0.0.1:4173/` (otro puerto con `PORT=4181 node scripts/serve-site.mjs`). Abrir los HTML con `file://` no funciona porque los módulos ES necesitan HTTP, y la página 404 usa rutas absolutas `/Pokedex-Retro/…`, así que solo se ve bien servida bajo esa ruta, como en GitHub Pages.

## Servidor MCP

```bash
npm ci --prefix mcp
claude mcp add pokedex-retro -- node /ruta/a/Pokedex-Retro/mcp/bin/pokedex-mcp.js
```

Sustituye la ruta por la de tu clon. Tools, configuración en Claude Desktop, variables de entorno e inspector: [`mcp/README.md`](mcp/README.md).

## Tests

Instala antes las dependencias con `npm ci` y `npm ci --prefix mcp`. Los tests no usan la red salvo Lighthouse.

| Comando                     | Qué cubre                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                  | Tests unitarios con `node --test` de `site/js` y `scripts`, con respuestas de PokéAPI simuladas                                                 |
| `npm run mcp:test`          | Tests del servidor MCP con PokéAPI simulada y procesos reales del binario                                                                       |
| `npm run test:mutation`     | Mutación con Stryker sobre `site/js/core` y `site/js/mappers` (umbral 95 %)                                                                     |
| `npm run test:mutation:ui`  | Mutación sobre `site/js/ui` en dos ejecuciones, `stryker.ui-render.config.json` y `stryker.ui.config.json` (umbral 85 %)                        |
| `npm run mcp:test:mutation` | Mutación sobre `mcp/src` en dos ejecuciones, `stryker.mcp-base.config.json` y `stryker.mcp.config.json` (umbral 85 %)                           |
| `npm run e2e`               | Smoke en Chromium con Playwright, PokéAPI simulada y auditoría axe; necesita antes `npx playwright install chromium`                            |
| `npm run lhci`              | Lighthouse sobre `index.html` y `tipos.html` contra PokéAPI real: accesibilidad, buenas prácticas y SEO exigen 0,95; el rendimiento es un aviso |

Lint, formato, typecheck, `check:html` y el flujo de ramas y commits: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Decisiones

- [0001: cabecera y navegación estáticas](docs/adr/0001-cabecera-navegacion-estaticas.md): HTML escrito a mano en cada página y comprobado en CI con `npm run check:html`.
- [0002: estrategia de caché](docs/adr/0002-estrategia-cache.md): listas en `localStorage` 24 h, detalles en memoria y `sessionStorage`, y caché del MCP en memoria con disco opcional.
- [0003: servidor MCP por stdio](docs/adr/0003-mcp-stdio.md): proceso local sin puertos ni servidor que desplegar.
- [0004: JavaScript con JSDoc y `// @ts-check`](docs/adr/0004-javascript-jsdoc-ts-check.md): tipos comprobados con `tsc` sin compilar la web.

## Licencia

[MIT](LICENSE). Las fuentes Press Start 2P y VT323 se distribuyen bajo la SIL Open Font License 1.1 ([`site/fonts/OFL.txt`](site/fonts/OFL.txt)).
