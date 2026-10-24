## MODIFIED Requirements

### Requirement: Decisiones de arquitectura registradas
El repositorio SHALL contener las ADR `docs/adr/0001` a `0006` con nombre `NNNN-titulo.md` y las secciones Contexto, Decisión, Consecuencias y Alternativas: cabecera y navegación estáticas con control en CI, estrategia de caché, MCP por stdio, JavaScript + JSDoc + `// @ts-check` en lugar de TypeScript, chat con la clave del visitante y `fetch` directo sin SDK, y chat multiproveedor con OpenAI tras un puerto de proveedor.

#### Scenario: ADR completa
- **WHEN** se abre cualquiera de las seis ADR
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
