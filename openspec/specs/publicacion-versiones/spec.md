# publicacion-versiones Specification

## Purpose
Garantiza que cada versión publicada del proyecto declara el mismo número en todos sus artefactos, queda marcada con una etiqueta anotada sobre `main` y se comprueba en la web desplegada.

## Requirements

### Requirement: Versiones coherentes
`npm test` SHALL comprobar que la versión de `package.json` coincide con la de `package-lock.json`, `mcp/package.json`, `mcp/package-lock.json`, `mcp/server.json` (versión del servidor y de cada paquete), `site/js/version.js` y la última versión publicada en `CHANGELOG.md`, y MUST fallar nombrando cada fichero divergente con su valor.

#### Scenario: Versiones coherentes en el commit de release
- **WHEN** en el commit de release se ejecuta `npm test`
- **THEN** un test confirma que `package.json`, `mcp/package.json`, `mcp/server.json` y `site/js/version.js` declaran `1.1.0`, igual que los lockfiles y la última entrada del `CHANGELOG.md`

#### Scenario: Manifiesto del MCP desactualizado
- **WHEN** `package.json` declara `1.1.0` y `mcp/server.json` declara `1.0.0`
- **THEN** `npm test` falla mostrando `mcp/server.json` con `1.0.0` frente a `1.1.0`

#### Scenario: Historial por delante
- **WHEN** `CHANGELOG.md` publica `[1.1.0]` y los manifiestos siguen en `1.0.0`
- **THEN** `npm test` falla mostrando la versión de `CHANGELOG.md` frente a la de `package.json`

### Requirement: Etiqueta de versión
Cada versión publicada SHALL marcarse con una etiqueta anotada `v<versión>` sobre el commit de `main` que la contiene, creada solo cuando el CI y el despliegue de Pages de ese commit han terminado en verde, con el mensaje `chore(release): versión <versión>`, y subida al remoto.

#### Scenario: Etiqueta v1.1.0
- **WHEN** el PR de la versión `1.1.0` se ha fusionado y el CI y Pages del último commit de `main` están en verde
- **THEN** existe en el remoto la etiqueta anotada `v1.1.0` con mensaje `chore(release): versión 1.1.0` que apunta a ese commit

#### Scenario: CI en rojo
- **WHEN** el CI o el despliegue de Pages del último commit de `main` no ha terminado en verde
- **THEN** no se crea la etiqueta

### Requirement: Web publicada verificada
Tras el despliegue de una versión, la web publicada en `https://renzoramosdev.github.io/Pokedex-Retro/` SHALL responder HTTP 200 en las 7 páginas, `404.html`, `robots.txt`, `sitemap.xml` y `manifest.webmanifest`, y `js/version.js` MUST exportar la versión etiquetada.

#### Scenario: Ficheros publicados
- **WHEN** se pide cada uno de los 11 ficheros a la web publicada tras etiquetar `v1.1.0`
- **THEN** todos responden 200

#### Scenario: Versión desplegada
- **WHEN** se pide `js/version.js` a la web publicada
- **THEN** contiene `1.1.0`
