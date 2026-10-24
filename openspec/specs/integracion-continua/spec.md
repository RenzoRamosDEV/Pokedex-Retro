# integracion-continua Specification

## Purpose
Garantiza que cada PR y cada cambio en `main` se validen automáticamente, que GitHub Pages solo publique código que ha pasado el CI y que las dependencias se mantengan actualizadas sin trabajo manual.

## Requirements

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

### Requirement: CI sin secretos
El workflow `CI` MUST NOT usar secretos del repositorio y SHALL ejecutarse con permisos de solo lectura sobre el contenido.

#### Scenario: PR desde un fork
- **WHEN** un PR llega desde un fork sin acceso a secretos
- **THEN** el workflow `CI` se ejecuta completo igual que en un PR interno

### Requirement: Despliegue condicionado al CI
El workflow de Pages SHALL dispararse solo por la finalización del workflow `CI` en un `push` a `main` o manualmente (`workflow_dispatch`), MUST NOT dispararse por `push`, y SHALL desplegar `site/` sin build, exactamente en el commit validado por el CI, únicamente si el CI terminó en `success`.

#### Scenario: Deploy bloqueado por CI rojo
- **WHEN** un push a `main` provoca un workflow `CI` que termina en `failure` y GitHub evalúa el workflow de Pages
- **THEN** no se ejecuta ningún job de despliegue

#### Scenario: Deploy tras CI verde
- **WHEN** un push a `main` provoca un workflow `CI` que termina en `success`
- **THEN** el workflow de Pages despliega `site/` del commit validado y la web publicada responde HTTP 200

#### Scenario: CI de un PR no despliega
- **WHEN** el workflow `CI` de un `pull_request` termina en `success`
- **THEN** no se ejecuta ningún job de despliegue

### Requirement: Actualización automática de dependencias
Dependabot SHALL revisar semanalmente las dependencias `npm` del directorio raíz y del directorio `/mcp` y las acciones de `github-actions` del directorio raíz, y abrir PR que pasan por el workflow `CI`.

#### Scenario: Dependencia desactualizada
- **WHEN** existe una versión nueva de una devDependency de la raíz
- **THEN** Dependabot abre un PR en su ejecución semanal y el workflow `CI` lo valida

#### Scenario: Dependencia del MCP desactualizada
- **WHEN** existe una versión nueva de `@modelcontextprotocol/sdk` o de `zod`
- **THEN** Dependabot abre un PR sobre `mcp/package.json` y `mcp/package-lock.json` y el workflow `CI` lo valida

### Requirement: e2e en Node 24
El workflow `CI` SHALL instalar solo Chromium con sus dependencias del sistema y ejecutar `npm run e2e` únicamente en la combinación de Node 24, en cada `pull_request` y `push` a `main`; su fallo MUST marcar el workflow como fallido.

#### Scenario: e2e en un PR
- **WHEN** el workflow `CI` de un PR corre en Node 24
- **THEN** se ejecuta `npm run e2e` y su fallo marca el workflow como fallido

#### Scenario: e2e omitido en Node 22
- **WHEN** el workflow `CI` corre en Node 22
- **THEN** no se instalan navegadores ni se ejecuta `npm run e2e`

### Requirement: Lighthouse CI en pull requests
El workflow `CI` SHALL ejecutar `npm run lhci` solo en eventos `pull_request` y solo en la combinación de Node 24, sin secretos ni subida de informes a servicios externos; su fallo MUST marcar el workflow como fallido.

#### Scenario: Lighthouse en un PR
- **WHEN** el workflow `CI` corre por un `pull_request` en Node 24
- **THEN** se ejecuta `npm run lhci`

#### Scenario: Push a main sin Lighthouse
- **WHEN** el workflow `CI` corre por un `push` a `main`
- **THEN** no se ejecuta `npm run lhci`
