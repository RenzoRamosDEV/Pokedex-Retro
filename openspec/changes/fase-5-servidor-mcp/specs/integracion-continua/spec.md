# Spec Delta

## MODIFIED Requirements

### Requirement: CI en pull requests y en main
El workflow `CI` SHALL ejecutarse en cada `pull_request` y en cada `push` a `main`, con una matriz de Node 22 y Node 24, y en cada combinación MUST ejecutar `npm ci`, `npm ci --prefix mcp`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html`, `npm test` y `npm run mcp:test`; cualquier paso fallido marca el workflow como fallido.

#### Scenario: PR con error de lint
- **WHEN** se abre un PR cuyo código tiene un error de ESLint
- **THEN** el workflow `CI` termina en `failure` en ambas versiones de Node

#### Scenario: PR con cabecera divergente
- **WHEN** se abre un PR en el que una página HTML tiene una cabecera distinta al resto
- **THEN** el workflow `CI` termina en `failure` en ambas versiones de Node

#### Scenario: PR con un test del MCP en rojo
- **WHEN** se abre un PR en el que falla un test de `mcp/test`
- **THEN** el workflow `CI` termina en `failure` en ambas versiones de Node

#### Scenario: PR correcto
- **WHEN** se abre un PR que cumple lint, formato, typecheck, cabeceras, tests de la web y tests del MCP
- **THEN** el workflow `CI` termina en `success` para Node 22 y Node 24

### Requirement: Mutación solo en Node 24
El workflow `CI` SHALL ejecutar `npm run test:mutation`, `npm run test:mutation:ui` y `npm run mcp:test:mutation` únicamente en la combinación de Node 24, con el mismo límite de 180 s por ejecución que en local.

#### Scenario: Matriz de Node 22
- **WHEN** el workflow `CI` corre en Node 22
- **THEN** los pasos de mutación se omiten

#### Scenario: Matriz de Node 24
- **WHEN** el workflow `CI` corre en Node 24
- **THEN** se ejecutan `npm run test:mutation`, `npm run test:mutation:ui` y `npm run mcp:test:mutation` y el fallo de cualquiera marca el workflow como fallido

### Requirement: Actualización automática de dependencias
Dependabot SHALL revisar semanalmente las dependencias `npm` del directorio raíz y del directorio `/mcp` y las acciones de `github-actions` del directorio raíz, y abrir PR que pasan por el workflow `CI`.

#### Scenario: Dependencia desactualizada
- **WHEN** existe una versión nueva de una devDependency de la raíz
- **THEN** Dependabot abre un PR en su ejecución semanal y el workflow `CI` lo valida

#### Scenario: Dependencia del MCP desactualizada
- **WHEN** existe una versión nueva de `@modelcontextprotocol/sdk` o de `zod`
- **THEN** Dependabot abre un PR sobre `mcp/package.json` y `mcp/package-lock.json` y el workflow `CI` lo valida
