# Spec Delta

## MODIFIED Requirements

### Requirement: Web publicada verificada
Tras el despliegue de una versión, la web publicada en `https://renzoramosdev.github.io/Pokedex-Retro/` SHALL responder HTTP 200 en las 8 páginas, `404.html`, `robots.txt`, `sitemap.xml` y `manifest.webmanifest`, `js/version.js` MUST exportar la versión etiquetada y la CSP de `chat.html` MUST incluir `https://api.anthropic.com` en `connect-src`.

#### Scenario: Ficheros publicados
- **WHEN** se pide cada uno de los 12 ficheros a la web publicada tras etiquetar `v1.2.0`
- **THEN** todos responden 200, `chat.html` incluido

#### Scenario: Versión desplegada
- **WHEN** se pide `js/version.js` a la web publicada
- **THEN** contiene `1.2.0`

#### Scenario: CSP del chat publicada
- **WHEN** se pide `chat.html` a la web publicada
- **THEN** su meta `Content-Security-Policy` contiene `connect-src https://pokeapi.co https://api.anthropic.com`
