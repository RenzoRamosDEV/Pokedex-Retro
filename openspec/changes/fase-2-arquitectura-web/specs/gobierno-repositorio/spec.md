# Spec Delta

## MODIFIED Requirements

### Requirement: Plantilla de pull request
El repositorio SHALL incluir `.github/PULL_REQUEST_TEMPLATE.md` con una checklist de `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html` y `npm run test:mutation`.

#### Scenario: Apertura de PR
- **WHEN** se abre un PR en GitHub
- **THEN** la descripción se precarga con la checklist de las seis comprobaciones
