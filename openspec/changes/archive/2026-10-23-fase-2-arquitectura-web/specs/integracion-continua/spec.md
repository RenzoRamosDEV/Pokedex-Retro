# Spec Delta

## MODIFIED Requirements

### Requirement: CI en pull requests y en main
El workflow `CI` SHALL ejecutarse en cada `pull_request` y en cada `push` a `main`, con una matriz de Node 22 y Node 24, y en cada combinación MUST ejecutar `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html` y `npm test`; cualquier paso fallido marca el workflow como fallido.

#### Scenario: PR con error de lint
- **WHEN** se abre un PR cuyo código tiene un error de ESLint
- **THEN** el workflow `CI` termina en `failure` en ambas versiones de Node

#### Scenario: PR con cabecera divergente
- **WHEN** se abre un PR en el que una página HTML tiene una cabecera distinta al resto
- **THEN** el workflow `CI` termina en `failure` en ambas versiones de Node

#### Scenario: PR correcto
- **WHEN** se abre un PR que cumple lint, formato, typecheck, cabeceras y tests
- **THEN** el workflow `CI` termina en `success` para Node 22 y Node 24
