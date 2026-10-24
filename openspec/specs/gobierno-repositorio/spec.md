# gobierno-repositorio Specification

## Purpose
Mantiene versionados en el repositorio el plan de evolución, las decisiones de arquitectura, la licencia y las normas de contribución, para que cualquier colaborador conozca reglas y decisiones sin fuentes externas.

## Requirements

### Requirement: Plan de evolución versionado
El repositorio SHALL contener `docs/PLAN.md` con el diagnóstico del repo (rutas y líneas), la estructura objetivo, las reglas comunes de las 6 fases, las 6 fases con entregable y criterio de cierre, las decisiones tomadas y los riesgos.

#### Scenario: Consulta del plan
- **WHEN** un colaborador abre `docs/PLAN.md` en `main`
- **THEN** encuentra las secciones de diagnóstico, estructura objetivo, reglas comunes, fases, decisiones y riesgos

### Requirement: Decisiones de arquitectura registradas
El repositorio SHALL contener las ADR `docs/adr/0001` a `0007` con nombre `NNNN-titulo.md` y las secciones Contexto, Decisión, Consecuencias y Alternativas: cabecera y navegación estáticas con control en CI, estrategia de caché, MCP por stdio, JavaScript + JSDoc + `// @ts-check` en lugar de TypeScript, chat con la clave del visitante y `fetch` directo sin SDK, chat multiproveedor con OpenAI tras un puerto de proveedor, y agentes, subagentes y skills del chat con alcance solo Pokémon.

#### Scenario: ADR completa
- **WHEN** se abre cualquiera de las siete ADR
- **THEN** contiene las secciones Contexto, Decisión, Consecuencias y Alternativas

#### Scenario: Decisión trazable desde el plan
- **WHEN** la tabla de decisiones de `docs/PLAN.md` cita la ADR 0004
- **THEN** existe `docs/adr/0004-*.md` con esa decisión

#### Scenario: Riesgos de la clave documentados
- **WHEN** se lee la ADR 0005
- **THEN** explica por qué no se usa el SDK, los riesgos de tener la clave en el navegador y sus mitigaciones (CSP, escapado y `sessionStorage` por defecto)

#### Scenario: Multiproveedor documentado
- **WHEN** se lee la ADR 0006
- **THEN** explica por qué la Responses API con `fetch` directo y `store: false`, el puerto de proveedor, las claves separadas por proveedor y las alternativas descartadas (SDK de OpenAI, Chat Completions, proxy, abstracción genérica de proveedores)

#### Scenario: Agentes documentados
- **WHEN** se lee la ADR 0007
- **THEN** explica las definiciones de agentes y skills como módulos de datos en el repositorio, la delegación con profundidad 1 y su límite, la carga progresiva de skills, que el alcance solo Pokémon depende de las instrucciones (mejor esfuerzo, sin clasificador local), el coste adicional de la delegación y las alternativas descartadas (clasificador en el cliente, SDK de agentes, ficheros Markdown cargados en tiempo de ejecución, subagentes con delegación anidada)

### Requirement: Licencia
El repositorio SHALL incluir `LICENSE` con el texto de la licencia MIT, titular `Renzo Ramos` y año 2026.

#### Scenario: Licencia detectada
- **WHEN** GitHub analiza el repositorio en `main`
- **THEN** muestra la licencia MIT

### Requirement: Guía de contribución
El repositorio SHALL incluir `CONTRIBUTING.md` en español con el flujo de ramas y PR, el formato de commits y los comandos de comprobación.

#### Scenario: Nuevo colaborador
- **WHEN** un colaborador lee `CONTRIBUTING.md`
- **THEN** sabe cómo nombrar la rama, cómo escribir el commit y qué comandos deben pasar antes del PR

### Requirement: Plantilla de pull request
El repositorio SHALL incluir `.github/PULL_REQUEST_TEMPLATE.md` con una checklist de `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html` y `npm run test:mutation`.

#### Scenario: Apertura de PR
- **WHEN** se abre un PR en GitHub
- **THEN** la descripción se precarga con la checklist de las seis comprobaciones
