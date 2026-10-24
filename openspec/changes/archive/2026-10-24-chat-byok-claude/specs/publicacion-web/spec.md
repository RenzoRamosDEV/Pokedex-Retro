# Spec Delta

## MODIFIED Requirements

### Requirement: Indicaciones a rastreadores
`site/robots.txt` SHALL permitir el rastreo de todo el sitio e indicar `Sitemap: https://renzoramosdev.github.io/Pokedex-Retro/sitemap.xml`. `site/sitemap.xml` SHALL ser un sitemap XML válido que lista exactamente las 8 páginas de la web con esa base, incluida `chat.html`, sin incluir la página 404.

#### Scenario: Sitemap completo
- **WHEN** se leen las entradas `<loc>` de `site/sitemap.xml`
- **THEN** hay 8, una por página e incluida `chat.html`, todas con la base `https://renzoramosdev.github.io/Pokedex-Retro/`, y ninguna apunta a `404.html`

#### Scenario: Robots apunta al sitemap
- **WHEN** se lee `site/robots.txt`
- **THEN** permite todo (`User-agent: *` y `Allow: /`) y contiene la línea `Sitemap:` con la URL absoluta del sitemap
