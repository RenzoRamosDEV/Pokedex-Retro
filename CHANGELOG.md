# Historial de cambios

Todos los cambios relevantes de este proyecto se documentan en este fichero.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [1.1.0] - 2026-10-24

`1.0.0` fue la versión de trabajo de `package.json` desde la fase 2 y nunca se etiquetó ni publicó; los cambios de las fases 1–5 se publican juntos en esta versión.

### Añadido

- CI en cada pull request y en cada push a `main` con Node 22 y 24: lint con ESLint, formato con Prettier, typecheck con `tsc`, hook de pre-commit y Dependabot.
- Plan del proyecto, cuatro ADR, licencia MIT, guía de contribución y plantilla de pull request.
- Cliente HTTP con reintentos, plazo de 10 s y cancelación al salir de la página.
- Caché de listas completas en `localStorage` (24 h) y de detalles en memoria y `sessionStorage`.
- Como máximo 6 peticiones de detalle simultáneas y aviso de los elementos que no se pudieron cargar.
- Página 404, `robots.txt`, `sitemap.xml` y manifiesto web con iconos.
- Versión de la web en el panel INFO, generada desde `package.json`.
- Detalle de Pokémon en un `<dialog>` nativo con enlace profundo `#pokemon-<id>`.
- Enlace para saltar al contenido, aviso `<noscript>`, región de estado anunciada, soporte de `prefers-reduced-motion` y tema inicial según `prefers-color-scheme`.
- Tests de la interfaz, mutación de `site/js/ui`, smoke e2e con Playwright y axe, y presupuestos de Lighthouse CI.
- Servidor MCP local por stdio con 12 tools, 2 resources y 2 prompts, caché en memoria y en disco opcional, registros en stderr y cierre limpio con `SIGINT` y `SIGTERM`.

### Cambiado

- GitHub Pages despliega solo tras un CI correcto de un push a `main`.
- Textos de la interfaz en español y centralizados en `strings.js` (`ANT.`, `SIG.`, `OCULTA`).
- El tema ya no tiene efectos al importarse y funciona aunque el almacenamiento falle.
- Meta description de las páginas corregida.
- Menú móvil y desplegables de tema e información operables por teclado.
- Contraste WCAG 2.1 AA en los temas NORMAL, DMG y MONO.
- Los reintentos ante 429 respetan la cabecera `Retry-After`.

### Seguridad

- Content Security Policy en `<meta>` sin `'unsafe-inline'` ni `'unsafe-eval'`.
- HTML sin estilos, scripts ni manejadores de eventos en línea, comprobado con un test.
- Fuentes autoalojadas; ya no se cargan desde Google Fonts.
- Workflows sin secretos y con permisos mínimos.

## [1.0.0-RC.0] - 2026-10-23

La etiqueta `v1.0.0-RC.0` apunta al primer commit del repositorio (`dcfbae7`, solo `package.json` y la configuración de Stryker); la versión inicial que se describe aquí es la del commit `73b20e6`, punto de partida del plan.

### Añadido

- Pokédex estática sobre PokéAPI v2 con HTML, CSS y JavaScript en módulos ES, sin frameworks ni build.
- Siete secciones (Pokédex, movimientos, tipos, habilidades, naturalezas, objetos y bayas) con buscador por nombre y, salvo Tipos y Naturalezas, paginación en la URL.
- Ficha detallada de cada Pokémon.
- Tres temas: NORMAL, DMG y MONO.
- Tests con `node --test` y mutación con Stryker sobre `site/js/core` y `site/js/mappers`.
- Despliegue de `site/` en GitHub Pages.

[1.1.0]: https://github.com/RenzoRamosDEV/Pokedex-Retro/compare/v1.0.0-RC.0...v1.1.0
[1.0.0-RC.0]: https://github.com/RenzoRamosDEV/Pokedex-Retro/releases/tag/v1.0.0-RC.0
