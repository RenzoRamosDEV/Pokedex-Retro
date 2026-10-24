# Propuesta: Fase 6 — documentación de portafolio y versión 1.1.0

## Why

Las fases 1–5 están fusionadas en `main`, pero nada las presenta ni las agrupa: el `README.md` creció por acumulación, tiene afirmaciones que ya no son ciertas (dice que Pages publica en cada push a `main` tras `npm test`, cuando desde la fase 1 despliega por `workflow_run` solo tras un CI verde; exige 0,95 en rendimiento de Lighthouse, que desde la fase 4 es un aviso), no hay demo visual, ni documento de arquitectura, ni historial de cambios, y la última versión etiquetada sigue siendo `v1.0.0-RC.0`. Esta fase cierra el plan: presenta el proyecto como pieza de portafolio y publica las fases 1–5 como `v1.1.0`.

## What Changes

- `README.md` reescrito en español con este orden fijo: título y una frase; GIF de demo; enlace a la demo `https://renzoramosdev.github.io/Pokedex-Retro/`; características; diagrama de arquitectura en Mermaid; cómo ejecutar la web en local; cómo usar el MCP (enlace a `mcp/README.md` y `claude mcp add pokedex-retro -- node /ruta/a/Pokedex-Retro/mcp/bin/pokedex-mcp.js`); cómo testear (unit, mutación de `core`/`mappers`, `ui` y `mcp`, e2e, Lighthouse); decisiones con enlace a cada ADR; licencia. Cada afirmación se contrasta con el código y la configuración actuales.
- `docs/ARCHITECTURE.md`: dos diagramas Mermaid (`HTML → ui → core → api → PokéAPI` y `Claude → mcp → core/mappers → PokéAPI`), responsabilidades de cada carpeta, flujo de una búsqueda, estrategia de caché, seguridad, publicación en Pages y enlaces a las ADR. Recoge el detalle técnico que sale del README.
- `docs/media/demo.gif` (≤ 3 MB, ≤ 15 s) generado por `scripts/capture-demo.mjs`: Playwright contra `site/` servido localmente con PokéAPI simulada por los fixtures del e2e y `ffmpeg` para el GIF. Reproducible y fuera de CI.
- `CHANGELOG.md` en formato Keep a Changelog y en español con las entradas `1.0.0-RC.0` (versión inicial) y `1.1.0` (fases 1–5 en Añadido / Cambiado / Seguridad), explicando que `1.0.0` fue la versión de trabajo de `package.json` y nunca se etiquetó.
- Versión `1.1.0` en `package.json`, `mcp/package.json`, `mcp/server.json`, `site/js/version.js` y en ambos lockfiles, con un test en `npm test` que falla si alguno difiere de `package.json` o de la última versión publicada del `CHANGELOG.md`.
- `CONTRIBUTING.md` corregido (faltan `mcp:test:mutation` y `mcp:inspect` en la tabla) y con el procedimiento de versión; `docs/PLAN.md` con el estado final de las seis fases.
- Tras fusionar el PR con CI y Pages en verde en `main`: tag anotado `v1.1.0` sobre ese commit, subido con `git push origin v1.1.0`, y verificación HTTP 200 de la web publicada.

Fuera de alcance: publicar el paquete del MCP en npm o en el registro MCP; GitHub Release con binarios; cambios de comportamiento en la web o en el MCP; ejecutar la captura de la demo en CI.

## Capabilities

### New Capabilities

- `documentacion-proyecto`: documentación pública del repositorio: README de portafolio con orden fijo, documento de arquitectura, historial de cambios y demo animada reproducible.
- `publicacion-versiones`: coherencia de la versión entre manifiestos, lockfiles, web e historial de cambios; etiqueta anotada de cada versión publicada; verificación de la web desplegada.

### Modified Capabilities

Ninguna: la web, el MCP, el CI y las comprobaciones existentes no cambian de comportamiento.

## Impact

- **Ficheros nuevos**: `docs/ARCHITECTURE.md`, `docs/media/demo.gif`, `scripts/capture-demo.mjs`, `scripts/capture-demo.test.mjs`, `scripts/version-coherence.test.mjs`, `CHANGELOG.md`.
- **Ficheros modificados**: `README.md`, `CONTRIBUTING.md`, `docs/PLAN.md`, `package.json`, `package-lock.json`, `mcp/package.json`, `mcp/package-lock.json`, `mcp/server.json`, `site/js/version.js`.
- **Web publicada**: solo cambia la versión del panel INFO (`1.0.0` → `1.1.0`).
- **Dependencias**: ninguna nueva en npm; `ffmpeg` y `ffprobe` como herramientas locales del script de demo.
- **Repositorio remoto**: nueva etiqueta `v1.1.0`; no dispara ningún workflow (el CI solo escucha PR y push a `main`).
