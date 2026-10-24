# Spec Delta

## Purpose

Presenta el repositorio a quien lo visita por primera vez: qué es, cómo se ve, cómo se ejecuta y prueba, cómo está construido y qué ha cambiado entre versiones, con información comprobable contra el código.

## ADDED Requirements

### Requirement: README de portafolio
`README.md` SHALL estar en español y contener, en este orden: título y una frase de qué es; el GIF `docs/media/demo.gif`; el enlace `https://renzoramosdev.github.io/Pokedex-Retro/`; características; un diagrama de arquitectura en Mermaid; cómo ejecutar la web en local; cómo usar el MCP; cómo testear; decisiones; licencia.

#### Scenario: Orden de las secciones
- **WHEN** se lee `README.md` de arriba abajo
- **THEN** aparecen el título con su frase, el GIF, el enlace a la demo, las características, el bloque `mermaid`, la ejecución en local, el MCP, los tests, las decisiones y la licencia, en ese orden

#### Scenario: Uso del MCP
- **WHEN** se lee la sección del MCP
- **THEN** enlaza a `mcp/README.md` e incluye el comando `claude mcp add pokedex-retro -- node /ruta/a/Pokedex-Retro/mcp/bin/pokedex-mcp.js`

#### Scenario: Tests documentados
- **WHEN** se lee la sección de tests
- **THEN** documenta `npm test`, `npm run mcp:test`, `npm run test:mutation`, `npm run test:mutation:ui`, `npm run mcp:test:mutation`, `npm run e2e` y `npm run lhci`

#### Scenario: Decisiones enlazadas
- **WHEN** se siguen los enlaces de la sección de decisiones
- **THEN** cada una de las ADR `0001` a `0004` de `docs/adr/` tiene un enlace que resuelve a su fichero

### Requirement: Documentación fiel al repositorio
Toda afirmación factual de `README.md`, `docs/ARCHITECTURE.md` y `CONTRIBUTING.md` SHALL coincidir con el código y la configuración versionados: cada `npm run <script>` citado MUST existir en `package.json` y cada ruta citada MUST existir.

#### Scenario: Despliegue descrito
- **WHEN** la documentación describe la publicación en GitHub Pages
- **THEN** indica que se publica `site/` solo tras un CI correcto de un push a `main` (o a mano) y no en cada push

#### Scenario: Presupuesto de rendimiento
- **WHEN** la documentación describe Lighthouse
- **THEN** indica que accesibilidad, buenas prácticas y SEO exigen 0,95 y que el rendimiento es un aviso

#### Scenario: Script inexistente
- **WHEN** la documentación cita `npm run <script>` y `package.json` no declara ese script
- **THEN** la revisión de cierre de la fase lo rechaza

### Requirement: Demo animada reproducible
`docs/media/demo.gif` SHALL ocupar como máximo 3 000 000 bytes y durar como máximo 15 s, y SHALL generarse con `node scripts/capture-demo.mjs` sobre `site/` servido localmente con PokéAPI simulada, sin peticiones externas. El script MUST NOT formar parte de CI.

#### Scenario: Límites del GIF
- **WHEN** se inspecciona `docs/media/demo.gif`
- **THEN** pesa 3 000 000 bytes o menos y su duración es de 15 s o menos

#### Scenario: GIF fuera de límites
- **WHEN** la captura produce un GIF de más de 3 000 000 bytes o de más de 15 s
- **THEN** el script termina con código distinto de 0 indicando el límite superado y el valor medido

#### Scenario: Sin red externa
- **WHEN** se ejecuta el script sin acceso a internet
- **THEN** genera el GIF y termina con código 0

#### Scenario: Fuera de CI
- **WHEN** se revisan los workflows de `.github/workflows/`
- **THEN** ninguno ejecuta `scripts/capture-demo.mjs`

### Requirement: Arquitectura documentada
`docs/ARCHITECTURE.md` SHALL contener un diagrama Mermaid del flujo `HTML → ui → core → api → PokéAPI`, otro del flujo `Claude → mcp → core/mappers → PokéAPI`, las responsabilidades de cada carpeta, el flujo de una búsqueda, la estrategia de caché y enlaces a las ADR.

#### Scenario: Diagramas
- **WHEN** GitHub renderiza `docs/ARCHITECTURE.md`
- **THEN** muestra dos diagramas Mermaid: uno con HTML, `ui`, `core`, `api` y PokéAPI, y otro con Claude, `mcp`, `core`/`mappers` y PokéAPI

#### Scenario: Caché documentada
- **WHEN** se lee la estrategia de caché
- **THEN** describe las listas en `localStorage` con TTL de 24 h, los detalles en memoria y `sessionStorage`, y la caché del MCP en memoria de 24 h con disco opcional, y enlaza la ADR 0002

### Requirement: Historial de cambios
`CHANGELOG.md` SHALL seguir el formato Keep a Changelog en español, con las versiones de la más reciente a la más antigua, fecha `AAAA-MM-DD` y enlaces de comparación. MUST incluir `1.0.0-RC.0` como versión inicial y `1.1.0` con las fases 1–5 en las secciones Añadido, Cambiado y Seguridad.

#### Scenario: Entradas publicadas
- **WHEN** se lee `CHANGELOG.md`
- **THEN** la primera versión es `[1.1.0]` con las secciones `Añadido`, `Cambiado` y `Seguridad`, seguida de `[1.0.0-RC.0]`

#### Scenario: Versión de trabajo no publicada
- **WHEN** se lee la entrada `1.1.0`
- **THEN** explica que `1.0.0` fue la versión de trabajo de `package.json` y que nunca se etiquetó
