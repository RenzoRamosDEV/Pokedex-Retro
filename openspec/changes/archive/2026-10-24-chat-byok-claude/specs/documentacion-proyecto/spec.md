# Spec Delta

## MODIFIED Requirements

### Requirement: README de portafolio
`README.md` SHALL estar en español y contener, en este orden: título y una frase de qué es; el GIF `docs/media/demo.gif`; el enlace `https://renzoramosdev.github.io/Pokedex-Retro/`; características; un diagrama de arquitectura en Mermaid; cómo ejecutar la web en local; cómo usar el chat; cómo usar el MCP; cómo testear; decisiones; licencia.

#### Scenario: Orden de las secciones
- **WHEN** se lee `README.md` de arriba abajo
- **THEN** aparecen el título con su frase, el GIF, el enlace a la demo, las características, el bloque `mermaid`, la ejecución en local, el chat, el MCP, los tests, las decisiones y la licencia, en ese orden

#### Scenario: Uso del chat
- **WHEN** se lee la sección del chat
- **THEN** explica que hace falta una clave propia de Anthropic, que se queda en el navegador y solo se envía a `api.anthropic.com`, que el coste va a la cuenta del visitante y qué modelos se pueden elegir

#### Scenario: Uso del MCP
- **WHEN** se lee la sección del MCP
- **THEN** enlaza a `mcp/README.md` e incluye el comando `claude mcp add pokedex-retro -- node /ruta/a/Pokedex-Retro/mcp/bin/pokedex-mcp.js`

#### Scenario: Tests documentados
- **WHEN** se lee la sección de tests
- **THEN** documenta `npm test`, `npm run mcp:test`, `npm run test:mutation`, `npm run test:mutation:chat`, `npm run test:mutation:ui`, `npm run mcp:test:mutation`, `npm run e2e` y `npm run lhci`

#### Scenario: Decisiones enlazadas
- **WHEN** se siguen los enlaces de la sección de decisiones
- **THEN** cada una de las ADR `0001` a `0005` de `docs/adr/` tiene un enlace que resuelve a su fichero

### Requirement: Arquitectura documentada
`docs/ARCHITECTURE.md` SHALL contener un diagrama Mermaid del flujo `HTML → ui → core → api → PokéAPI`, otro del flujo `Claude → mcp → core/mappers → PokéAPI`, otro del flujo `chat.html → chat → core/mappers/api → PokéAPI` y `→ api.anthropic.com`, las responsabilidades de cada carpeta, el flujo de una búsqueda, la estrategia de caché y enlaces a las ADR.

#### Scenario: Diagramas
- **WHEN** GitHub renderiza `docs/ARCHITECTURE.md`
- **THEN** muestra tres diagramas Mermaid: uno con HTML, `ui`, `core`, `api` y PokéAPI; otro con Claude, `mcp`, `core`/`mappers` y PokéAPI; y otro con `chat.html`, `chat`, `core`/`mappers`/`api`, PokéAPI y `api.anthropic.com`

#### Scenario: Caché documentada
- **WHEN** se lee la estrategia de caché
- **THEN** describe las listas en `localStorage` con TTL de 24 h, los detalles en memoria y `sessionStorage`, y la caché del MCP en memoria de 24 h con disco opcional, y enlaza la ADR 0002
