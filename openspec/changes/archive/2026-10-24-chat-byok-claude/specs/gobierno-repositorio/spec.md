# Spec Delta

## MODIFIED Requirements

### Requirement: Decisiones de arquitectura registradas
El repositorio SHALL contener las ADR `docs/adr/0001` a `0005` con nombre `NNNN-titulo.md` y las secciones Contexto, Decisión, Consecuencias y Alternativas: cabecera y navegación estáticas con control en CI, estrategia de caché, MCP por stdio, JavaScript + JSDoc + `// @ts-check` en lugar de TypeScript, y chat con la clave del visitante llamando a la API de Claude con `fetch` directo sin SDK.

#### Scenario: ADR completa
- **WHEN** se abre cualquiera de las cinco ADR
- **THEN** contiene las secciones Contexto, Decisión, Consecuencias y Alternativas

#### Scenario: Decisión trazable desde el plan
- **WHEN** la tabla de decisiones de `docs/PLAN.md` cita la ADR 0004
- **THEN** existe `docs/adr/0004-*.md` con esa decisión

#### Scenario: Riesgos de la clave documentados
- **WHEN** se lee la ADR 0005
- **THEN** explica por qué no se usa el SDK, los riesgos de tener la clave en el navegador y sus mitigaciones (CSP, escapado y `sessionStorage` por defecto)
