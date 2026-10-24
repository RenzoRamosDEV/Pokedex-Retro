# Spec Delta

## MODIFIED Requirements

### Requirement: Actualización automática de dependencias
Dependabot SHALL revisar semanalmente las dependencias `npm` del directorio raíz y del directorio `/mcp` y las acciones de `github-actions` del directorio raíz, y abrir PR que pasan por el workflow `CI`. Como el proyecto apunta a Node 22, cada entrada `npm` que gestione `@types/node` MUST ignorar sus actualizaciones de versión mayor (`version-update:semver-major`).

#### Scenario: Dependencia desactualizada
- **WHEN** existe una versión nueva de una devDependency de la raíz
- **THEN** Dependabot abre un PR en su ejecución semanal y el workflow `CI` lo valida

#### Scenario: Dependencia del MCP desactualizada
- **WHEN** existe una versión nueva de `@modelcontextprotocol/sdk` o de `zod`
- **THEN** Dependabot abre un PR sobre `mcp/package.json` y `mcp/package-lock.json` y el workflow `CI` lo valida

#### Scenario: Tipos de una versión mayor de Node
- **WHEN** se publica `@types/node` con una versión mayor superior a la de Node declarada
- **THEN** Dependabot no abre PR para ella, pero sí para versiones menores y parches de la mayor actual
