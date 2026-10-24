# Diseño: Fase 6 — documentación de portafolio y versión 1.1.0

## Context

- Motivación y alcance: ver proposal.md. Requisitos: `specs/documentacion-proyecto` y `specs/publicacion-versiones`.
- Estado observado en `main` (tras archivar la fase 5):
  - `README.md` acumula secciones por fase (Secciones, Rendimiento, Seguridad, Accesibilidad, Temas, Uso en local, Tests, Servidor MCP, Estructura, Versión, Despliegue). Hechos desactualizados: «Despliegue» dice que `pages.yml` ejecuta `npm test` y publica en cada push a `main` (hoy `pages.yml` se dispara por `workflow_run` del CI en `main` con `conclusion == 'success'` y `event == 'push'`, más `workflow_dispatch`, y no ejecuta tests); «Tests» dice «mínimo 0,95 en rendimiento» (en `lighthouserc.json` `categories:performance` es `warn`); «Uso en local» propone `python3 -m http.server -d site` cuando el repo ya trae `node scripts/serve-site.mjs` (puerto `4173` o `PORT`); «Versión» solo menciona `package.json` y `version.js`.
  - `CONTRIBUTING.md`: la tabla de comandos no tiene `mcp:test:mutation` (sí la frase final) ni `mcp:inspect`. `.github/PULL_REQUEST_TEMPLATE.md` es correcto.
  - `docs/PLAN.md` termina en «Aprobar este plan para empezar la fase 1».
  - Versiones: `package.json`, `mcp/package.json`, `mcp/server.json` (`version` y `packages[0].version`), ambos lockfiles y `site/js/version.js` en `1.0.0`. La única etiqueta es `v1.0.0-RC.0` (anotada, 2026-10-23, mensaje `chore: versión candidata inicial`); en ese commit `package.json` no tenía campo `version`: `1.0.0` lo fijó la fase 2 (`feat(site): muestra la versión desde version.js`).
  - Coherencia ya cubierta: `site/js/version.test.js` (`version.js` = `package.json`) y `mcp/test/package.test.js` (`server.json` = `mcp/package.json`). Nada compara la raíz con `mcp/`.
  - Script `version` de npm: `node scripts/sync-version.mjs && git add site/js/version.js`.
  - Herramientas reutilizables: `createSiteServer(root)` exportado por `scripts/serve-site.mjs` (el arranque está protegido por la guarda de CLI); `mockPokeApi(page)` de `tests/e2e/pokeapi-mock.js` simula `https://pokeapi.co/api/v2/**` y los sprites, aborta cualquier otra petición externa y registra violaciones de CSP en `record`. `/usr/bin/ffmpeg` y `/usr/bin/ffprobe` disponibles en el equipo.
  - El e2e usa el puerto 4180 porque 4173 puede estar ocupado.

## Goals / Non-Goals

**Goals:**

- Un README corto y comprobable que sirva de portada; el detalle técnico vive en `docs/ARCHITECTURE.md`.
- Una demo reproducible con un único comando y sin red.
- Que una futura versión no pueda dejar un manifiesto atrás sin que `npm test` falle.

**Non-Goals:**

- Cambiar comportamiento de la web, del MCP o del CI.
- Automatizar la publicación (GitHub Release, npm, registro MCP) o la captura de la demo en CI.
- Comprobar documentación con tests permanentes (enlaces, scripts citados): la fidelidad se verifica en la revisión de cierre.

## Decisions

### D1. Dos capacidades nuevas, ninguna modificada

- `documentacion-proyecto` (README, arquitectura, changelog, demo) y `publicacion-versiones` (coherencia de versión, etiqueta, verificación de la web).
- `calidad-codigo` «Versión sincronizada» no cambia: `version.js` sigue generándose desde `package.json`. La coherencia entre manifiestos es una regla de publicación, no de calidad del código.
- Alternativa descartada: meter README/CHANGELOG en `gobierno-repositorio`. Su propósito es plan, ADR, licencia y contribución (normas internas); la documentación pública evoluciona por otros motivos.
- Observación sin acción: el escenario de `gobierno-repositorio` «Plantilla de pull request» habla de seis comprobaciones y la plantilla tiene once; la plantilla cumple el requisito (las incluye) y cambiar el spec no es objeto de esta fase.

### D2. README: diez bloques y nada más

Orden exacto (spec «README de portafolio»):

1. `# Pokédex Retro` + una frase: Pokédex estática con estética Game Boy sobre PokéAPI v2, sin frameworks ni build, con servidor MCP para Claude.
2. `![Demo de la Pokédex Retro](docs/media/demo.gif)`.
3. `**Demo:** https://renzoramosdev.github.io/Pokedex-Retro/`.
4. `## Características`: viñetas cortas — 7 secciones (Pokédex, movimientos, tipos, habilidades, naturalezas, objetos, bayas) con búsqueda y paginación en la URL; ficha en `<dialog>` con enlace profundo `#pokemon-<id>`; tres temas (NORMAL, DMG, MONO); caché y máx. 6 peticiones; CSP sin `'unsafe-inline'` y fuentes autoalojadas; WCAG 2.1 AA auditado con axe; servidor MCP con 12 tools, 2 resources y 2 prompts.
5. `## Arquitectura`: un único Mermaid `flowchart LR` con las dos entradas (navegador → HTML → `ui` → `core`/`mappers` → `api` → PokéAPI; Claude → `mcp` → `core`/`mappers` + `api` → PokéAPI) y enlace a `docs/ARCHITECTURE.md`.
6. `## Ejecutar en local`: `node scripts/serve-site.mjs` → `http://127.0.0.1:4173/` (o `PORT=…`); requisito Node ≥ 22; aviso de `file://` y de la 404 con rutas `/Pokedex-Retro/`. Se elimina `python3 -m http.server`: Node ya es requisito y el script es el que usa el e2e.
7. `## Servidor MCP`: `npm ci --prefix mcp`, `claude mcp add pokedex-retro -- node /ruta/a/Pokedex-Retro/mcp/bin/pokedex-mcp.js`, enlace a `mcp/README.md` (tools, Claude Desktop, variables, inspector).
8. `## Tests`: tabla comando → qué cubre: `npm test`, `npm run mcp:test`, `npm run test:mutation` (core + mappers, 95 %), `npm run test:mutation:ui` (`stryker.ui-render.config.json` + `stryker.ui.config.json`, 85 %), `npm run mcp:test:mutation` (`stryker.mcp-base.config.json` + `stryker.mcp.config.json`, 85 %), `npm run e2e` (Chromium, PokéAPI simulada, axe, `npx playwright install chromium` antes), `npm run lhci` (red real; a11y/buenas prácticas/SEO 0,95 como error, rendimiento como aviso). Enlace a `CONTRIBUTING.md` para lint, formato, typecheck y `check:html`.
9. `## Decisiones`: lista con enlace a cada `docs/adr/000N-*.md` y una línea de resumen.
10. `## Licencia`: MIT, enlace a `LICENSE`; fuentes bajo OFL 1.1 (`site/fonts/OFL.txt`).

- El contenido detallado que sale (rendimiento, seguridad, accesibilidad, temas, estructura, despliegue) pasa a `docs/ARCHITECTURE.md`; el procedimiento de versión pasa a `CONTRIBUTING.md` (D7). Nada se pierde: se mueve.
- Alternativa descartada: conservar las secciones actuales tras «Licencia». Rompe el orden exigido y vuelve a mezclar portada y manual.

### D3. `docs/ARCHITECTURE.md`

Secciones: Visión general · Web (Mermaid 1) · Servidor MCP (Mermaid 2) · Carpetas · Flujo de una búsqueda · Caché · Seguridad · Accesibilidad y temas · Publicación · Decisiones.

- Mermaid 1 (`flowchart LR`): `HTML (site/*.html)` → `ui` (`main.js`, `render-*`, `dialog`, `theme`) → `core` (`query`, `search`, `pagination`, `load-section`, `limit`) → `api` (`client.js`, `cache.js`) → PokéAPI; `mappers` colgando de `core`. Nota bajo el diagrama: `core` no importa `api`; recibe `fetchJson` inyectado, que `ui/main.js` construye con `createFetchJson` y las cachés (puerto y adaptador).
- Mermaid 2: `Claude Desktop / Claude Code` →|stdio JSON-RPC| `mcp` (`bin/pokedex-mcp.js`, `server.js`, `tools/`, `resources/`, `prompts/`) → `core/mappers` → `mcp/src/client.js` (reutiliza `api/client.js`, `api/cache.js`, `core/limit.js`) → PokéAPI.
- Carpetas: tabla `site/`, `site/js/{api,core,mappers,ui}`, `mcp/{bin,src,test}`, `scripts/`, `tests/e2e/`, `docs/`, `.github/`, `openspec/`.
- Flujo de búsqueda (lista numerada contrastada con `load-section.js`): URL `?q=&page=` → `query.js` → sin consulta, lista paginada; con consulta, lista completa `limit=100000` (caché de listas) → `search.js` filtra → `pagination.js` → detalles con `createLimit(6)` y `Promise.allSettled` (caché de detalles) → mapper → orden por `id` → `render-*` y aviso `N ELEMENTOS NO SE PUDIERON CARGAR` en la región de estado.
- Caché: tabla de ADR 0002 (web listas `localStorage` `pokedex:lista:<url>` 24 h; detalles `Map` + `sessionStorage` `pokedex:detalle:<url>`; MCP memoria 24 h y disco opcional `POKEDEX_MCP_DISK_CACHE=1`, ficheros SHA-256 en `$XDG_CACHE_HOME/pokedex-mcp/` o `~/.cache/pokedex-mcp/`; fallos de almacenamiento tolerados).
- Publicación: `pages.yml` por `workflow_run` tras CI correcto de un push a `main` (+ `workflow_dispatch`), publica `site/` sin build; activación en Settings → Pages → GitHub Actions; `robots.txt`/`sitemap.xml` y su limitación en un sitio de proyecto.
- Cada afirmación se contrasta con el fichero que la respalda (lista de comprobación en tasks.md 2.1).

### D4. Demo: `scripts/capture-demo.mjs`

- Ejecución: `node scripts/capture-demo.mjs` desde la raíz. Requisitos: `npm ci`, `npx playwright install chromium`, `ffmpeg` y `ffprobe` en `PATH`. No se añade script npm ni paso de CI (YAGNI; se documenta en `CONTRIBUTING.md`).
- Servidor: `createSiteServer(<repo>/site).listen(0, '127.0.0.1')` y se lee el puerto asignado. Puerto efímero: no choca con 4173 ni con 4180 y no hace falta configurarlo.
- Navegador: `chromium` de `@playwright/test` importado dinámicamente dentro de `main()` (igual que `mockPokeApi`), para que importar el módulo en los tests no cargue Playwright ni los fixtures. Contexto con `viewport` y `recordVideo.size` 800 × 560, `colorScheme: 'light'` (tema inicial NORMAL determinista), `locale: 'es-ES'`. `mockPokeApi(page)` antes de la primera navegación; al terminar, `record.external` y `record.csp` deben estar vacíos o el script falla.
- Guion (~12,5 s útiles):

  | t aprox. | Acción                                                                                  | Pausa  |
  | -------- | --------------------------------------------------------------------------------------- | ------ |
  | 0,0 s    | `index.html` cargada (`.poke-card` visible) — inicio del recorte                        | 1,5 s  |
  | 1,5 s    | Escribe `pika` en `.search-input` con `pressSequentially(…, { delay: 150 })` y Enter     | 1,5 s  |
  | 3,6 s    | Clic en `a.card-link[href="#pokemon-25"]` → `dialog.modal[open]`                         | 2,5 s  |
  | 6,1 s    | Escape → diálogo cerrado                                                                | 0,5 s  |
  | 6,6 s    | `#theme-btn` → `.theme-option[data-value="gb"]` (tema DMG)                              | 1,8 s  |
  | 8,4 s    | `page.goto('tipos.html')` y espera a `.matrix-row-header` (el tema DMG persiste)         | 2,5 s  |
  | 10,9 s   | Fin del guion                                                                           | —      |

  Selectores tomados de `tests/e2e/smoke.spec.js`; navegar con `goto` evita depender del menú móvil según la anchura.

- Recorte: el vídeo de Playwright empieza al crear la página (en blanco). El script mide con `performance.now()` el instante en que `.poke-card` es visible respecto a la creación de la página y lo pasa como `-ss`; `-t 14` acota la duración.
- GIF en dos pasadas con `ffmpeg` (sin ficheros temporales de paleta: un solo filtro):

  ```text
  ffmpeg -y -ss <inicio> -t 14 -i <video.webm> \
    -vf "fps=10,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    -loop 0 docs/media/demo.gif
  ```

  Razones: 10 fps basta para una interfaz con pocas transiciones; la estética de pocos colores cabe en 64; `stats_mode=diff` y `diff_mode=rectangle` solo recodifican lo que cambia; `bayer` evita el ruido del dithering por difusión (que hincha el GIF). Sin reescalado: el pixel art se degrada al escalar.
- Escalera si supera 3 MB (constantes al inicio del script, se baja un peldaño cada vez y se anota el valor final en el PR): `fps` 10 → 8; `max_colors` 64 → 32; viewport 800 × 560 → 720 × 504.
- Validación: tras generar, `ffprobe -v error -show_entries format=duration -of csv=p=0 docs/media/demo.gif` y `statSync().size` pasan a `checkGifLimits({ bytes, seconds })`, función pura exportada que devuelve la lista de mensajes de límite superado (vacía si cumple): `demo.gif pesa <n> bytes (máximo 3000000)` y `demo.gif dura <s> s (máximo 15)`. Lista no vacía → mensajes a stderr y `process.exitCode = 1`. Límite de 3 000 000 bytes (MB decimal, el más estricto de las dos lecturas de «3 MB»).
- Ficheros temporales (vídeo) en `fs.mkdtempSync(os.tmpdir())`, borrados en `finally` junto con el cierre de navegador y servidor.
- Guarda de CLI idéntica a `sync-version.mjs` / `serve-site.mjs`: importar el módulo no captura nada.
- Tests (`scripts/capture-demo.test.mjs`, entra en `npm test` por el glob `scripts/**/*.test.mjs`): solo `checkGifLimits`, con valores límite (3 000 000 / 3 000 001 bytes; 15 / 15,001 s; ambos superados → dos mensajes en orden peso, duración; textos dorados) y un test de que importar el módulo no crea `docs/media/demo.gif` en un repo falso (como el de `sync-version.test.mjs`). La orquestación de navegador y `ffmpeg` se verifica ejecutando el script (tasks.md 3.4), no con tests: simularla costaría más que el script y no probaría nada real.
- Alternativas descartadas: capturas por fotograma con `page.screenshot` (más código y temporización frágil); GIF desde el CI (requisito: fuera de CI; además añadiría `ffmpeg` al runner); `gifski` (dependencia nueva no disponible).

### D5. Versión 1.1.0: mecanismo

- Raíz: `npm version 1.1.0 --no-git-tag-version` → `package.json` y `package-lock.json`, y el script `version` regenera `site/js/version.js` con `sync-version.mjs`.
- MCP: `npm version 1.1.0 --no-git-tag-version` ejecutado en `mcp/` → `mcp/package.json` y `mcp/package-lock.json`.
- `mcp/server.json`: `version` y `packages[0].version` a mano (dos campos).
- `--no-git-tag-version` porque la etiqueta se crea después de fusionar: `gh pr merge --rebase` reescribe los SHA, así que una etiqueta creada en la rama apuntaría a un commit que no está en `main`.
- Alternativa descartada: ampliar `sync-version.mjs` para escribir también los manifiestos de `mcp/`. Es código nuevo para dos ficheros que npm ya actualiza y un JSON de dos campos; el test de D6 impide el olvido, que es el riesgo real. Si las versiones se vuelven frecuentes, se reconsidera.

### D6. Test de coherencia: `scripts/version-coherence.test.mjs`

- Solo test, sin módulo de producción (no hay mutación que medir; se justifica en el PR).
- Referencia: `version` de `package.json`. Compara con: `package-lock.json` (`version` y `packages[""].version`), `mcp/package.json`, `mcp/package-lock.json` (`version` y `packages[""].version`), `mcp/server.json` (`version` y cada `packages[i].version`), `VERSION` importado de `site/js/version.js` y la primera cabecera `^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]` de `CHANGELOG.md` (ignora una futura `## [Sin publicar]`).
- Un único `assert.deepEqual(divergentes, [])` donde cada divergente es `` `${fichero} (${campo}): ${valor} ≠ ${referencia}` ``, para que el fallo muestre todos a la vez; más un test que exige que `CHANGELOG.md` tenga al menos una versión publicada.
- Por qué incluye el `CHANGELOG.md`: es lo que hace que el test nazca en rojo de forma natural (el historial ya publica `1.1.0` mientras los manifiestos dicen `1.0.0`) y deja una regla duradera — no se publica una versión sin su entrada — sin fijar `1.1.0` en el código del test, que rompería la siguiente versión.
- Solapa a propósito con `site/js/version.test.js` y `mcp/test/package.test.js`: esos protegen cada paquete por separado y siguen siendo útiles en `mcp:test`; no se tocan.

### D7. `CONTRIBUTING.md` y `docs/PLAN.md`

- `CONTRIBUTING.md`: filas `npm run mcp:test:mutation` (Stryker sobre `mcp/src` en dos ejecuciones, 85 %, 180 s cada una) y `npm run mcp:inspect` (MCP Inspector vía `npx`); sección `## Versiones` con el procedimiento de D5, la entrada del `CHANGELOG.md`, el test de D6 y la etiqueta tras fusionar; sección `## Demo` con `node scripts/capture-demo.mjs` y sus requisitos.
- `docs/PLAN.md`: línea `Estado: fases 1–6 completadas; publicado como `v1.1.0`.` bajo «Punto de partida» y la sección 9 pasa a «Plan completado: cada fase está archivada en `openspec/changes/archive/`». El resto del plan es histórico y no se reescribe.

### D8. CHANGELOG honesto con la versión 1.0.0

- Cabecera estándar Keep a Changelog traducida, con enlace a keepachangelog.com/es-ES/1.1.0 y a SemVer.
- `## [1.1.0] - AAAA-MM-DD` (fecha del commit de release) con una nota inicial: «`1.0.0` fue la versión de trabajo de `package.json` desde la fase 2 y nunca se etiquetó ni publicó; los cambios de las fases 1–5 se publican juntos en esta versión.» Después `### Añadido`, `### Cambiado`, `### Seguridad`.
- `## [1.0.0-RC.0] - 2026-10-23` con `### Añadido`: la versión inicial (Pokédex estática sobre PokéAPI v2, 7 secciones con búsqueda y paginación, ficha de Pokémon, tres temas, tests con `node:test` y Stryker en `core` + `mappers`, despliegue en Pages), contrastada con el árbol de `v1.0.0-RC.0`.
- Enlaces: `[1.1.0]: https://github.com/RenzoRamosDEV/Pokedex-Retro/compare/v1.0.0-RC.0...v1.1.0` y `[1.0.0-RC.0]: https://github.com/RenzoRamosDEV/Pokedex-Retro/releases/tag/v1.0.0-RC.0` (el primero resuelve al subir la etiqueta).
- Reparto de las fases 1–5 (fuente: proposal.md de cada cambio archivado):
  - **Añadido**: CI en PR y `main` (Node 22 y 24), lint, formato, typecheck, hooks y Dependabot; plan, ADR, licencia y guía de contribución; cliente HTTP con reintentos, plazo y cancelación; caché de listas y detalles; máx. 6 detalles simultáneos; aviso de elementos no cargados; 404, `robots.txt`, `sitemap.xml` y manifiesto; versión en el panel INFO; diálogo nativo con enlace profundo; salto al contenido, `<noscript>`, región de estado, `prefers-reduced-motion` y `prefers-color-scheme`; tests de UI, mutación de `ui`, e2e con axe y Lighthouse CI; servidor MCP (12 tools, 2 resources, 2 prompts, caché, registros a stderr, cierre limpio).
  - **Cambiado**: Pages despliega solo tras un CI verde; textos de la interfaz en español y centralizados (`ANT.`/`SIG.`, `OCULTA`); tema sin efectos al importar y tolerante al almacenamiento; meta description corregida; menú móvil y desplegables operables por teclado; contraste AA en los tres temas; reintentos que respetan `Retry-After`.
  - **Seguridad**: CSP en `<meta>` sin `'unsafe-inline'` ni `'unsafe-eval'`; HTML sin estilos, scripts ni manejadores en línea (con test); fuentes autoalojadas sin Google Fonts; workflows sin secretos y con permisos mínimos.

### D9. Commits y orden

| Orden | Asunto                                                                 | Contenido                                                     |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1     | `docs(openspec): añade el cambio de la fase 6`                         | este cambio                                                   |
| 2     | `docs(arch): documenta la arquitectura y la estrategia de caché`       | `docs/ARCHITECTURE.md`                                        |
| 3     | `docs(media): añade el script y el GIF de demo`                        | `scripts/capture-demo{,.test}.mjs`, `docs/media/demo.gif`     |
| 4     | `docs(readme): reescribe el README como portafolio`                    | `README.md`                                                   |
| 5     | `docs(contributing): documenta la versión, la demo y el MCP`           | `CONTRIBUTING.md`                                             |
| 6     | `docs(plan): marca las seis fases como completadas`                    | `docs/PLAN.md`                                                |
| 7     | `docs(changelog): añade el historial de cambios`                       | `CHANGELOG.md` con `[1.1.0]` fechada el día del commit         |
| 8     | `chore(release): publica la versión 1.1.0`                             | test de D6, manifiestos, lockfiles, `version.js`, fecha final |
| 9     | `docs(openspec): archiva el cambio fase-6-documentacion-version`       | archivo + specs nuevas                                        |

- Arquitectura antes que README porque el README la enlaza; la demo antes que el README porque el README la incrusta.
- El commit 7 deja `npm test` en verde (el test de D6 aún no existe); el 8 añade el test en rojo, sube las versiones y lo deja en verde dentro del mismo commit, para no versionar un estado roto.
- Rama `docs/fase-6-documentacion-version` (el tipo del commit principal de la fase es `docs`).

## Risks / Trade-offs

- [El GIF supera 3 MB] → escalera de D4; el script falla en vez de dejar un GIF fuera de límites.
- [Vídeo de Playwright con artefactos o recorte desplazado] → `-ss` medido, no fijo; revisión visual del GIF (primer y último fotograma) antes del commit.
- [El GIF queda desfasado si cambia la interfaz] → reproducible con un comando; no se automatiza (fuera de CI por requisito).
- [`npm version` en `mcp/` sin script `version`] → no hace falta: `mcp/` no genera ficheros; el test de D6 detecta cualquier olvido.
- [Afirmaciones del README que vuelven a quedar viejas] → la portada solo contiene hechos estables; el detalle está en un único sitio (`docs/ARCHITECTURE.md`) y la revisión de cierre contrasta scripts y rutas citados.
- [Etiqueta sobre un commit sin desplegar] → se crea solo tras comprobar `success` del CI y de Pages con `headSha` igual a `main`.
- [El enlace de comparación de `1.1.0` da 404 antes de subir la etiqueta] → aceptable durante la revisión del PR; resuelve al subirla.
- [Mermaid mal renderizado en GitHub] → se revisa la vista previa del PR en GitHub antes de fusionar.

## Migration Plan

- Sin migración de datos. La web solo cambia la versión del panel INFO.
- Despliegue: fusión del PR → CI en `main` → Pages por `workflow_run` → etiqueta `v1.1.0` → verificación HTTP.
- Marcha atrás: si la verificación falla tras etiquetar, se corrige con un PR nuevo y se publica `1.1.1`; la etiqueta `v1.1.0` no se mueve ni se borra una vez subida.
