# Spec Delta

## MODIFIED Requirements

### Requirement: Mutación solo en Node 24
El workflow `CI` SHALL ejecutar `npm run test:mutation`, `npm run test:mutation:chat`, `npm run test:mutation:ui` y `npm run mcp:test:mutation` únicamente en la combinación de Node 24, con el mismo límite de 180 s por ejecución que en local.

#### Scenario: Matriz de Node 22
- **WHEN** el workflow `CI` corre en Node 22
- **THEN** los pasos de mutación se omiten

#### Scenario: Matriz de Node 24
- **WHEN** el workflow `CI` corre en Node 24
- **THEN** se ejecutan `npm run test:mutation`, `npm run test:mutation:chat`, `npm run test:mutation:ui` y `npm run mcp:test:mutation` y el fallo de cualquiera marca el workflow como fallido
