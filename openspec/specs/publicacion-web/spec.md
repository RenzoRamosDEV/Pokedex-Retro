# publicacion-web Specification

## Purpose
Ficheros que acompañan a las páginas en GitHub Pages para rutas inexistentes, rastreadores y navegadores: página 404, `robots.txt`, `sitemap.xml` y manifiesto web con iconos, todos bajo la base `https://renzoramosdev.github.io/Pokedex-Retro/`.

## Requirements

### Requirement: Página 404
`site/404.html` SHALL mostrar el texto `ERROR 404` con la estética retro de la web y un enlace a `/Pokedex-Retro/index.html`. Como Pages la sirve en cualquier ruta inexistente, todas sus referencias a recursos propios (hoja de estilos, fuentes, iconos, manifiesto) MUST ser rutas absolutas que empiezan por `/Pokedex-Retro/`.

#### Scenario: Ruta inexistente
- **WHEN** se pide `https://renzoramosdev.github.io/Pokedex-Retro/no/existe`
- **THEN** se muestra `ERROR 404` con los estilos y fuentes de la web y un enlace que lleva a la portada

#### Scenario: Sin rutas relativas
- **WHEN** se inspeccionan los atributos `href` y `src` de `site/404.html`
- **THEN** todos empiezan por `/Pokedex-Retro/`

### Requirement: Indicaciones a rastreadores
`site/robots.txt` SHALL permitir el rastreo de todo el sitio e indicar `Sitemap: https://renzoramosdev.github.io/Pokedex-Retro/sitemap.xml`. `site/sitemap.xml` SHALL ser un sitemap XML válido que lista exactamente las 8 páginas de la web con esa base, incluida `chat.html`, sin incluir la página 404.

#### Scenario: Sitemap completo
- **WHEN** se leen las entradas `<loc>` de `site/sitemap.xml`
- **THEN** hay 8, una por página e incluida `chat.html`, todas con la base `https://renzoramosdev.github.io/Pokedex-Retro/`, y ninguna apunta a `404.html`

#### Scenario: Robots apunta al sitemap
- **WHEN** se lee `site/robots.txt`
- **THEN** permite todo (`User-agent: *` y `Allow: /`) y contiene la línea `Sitemap:` con la URL absoluta del sitemap

### Requirement: Manifiesto web
`site/manifest.webmanifest` SHALL ser JSON con `name: "Pokédex Retro"`, `short_name: "Pokédex"`, `lang: "es"`, `start_url: "./"`, `display: "standalone"`, `theme_color: "#cc2200"` e iconos PNG de 192×192 y 512×512 px generados del logotipo y versionados en `site/images/`. Cada página HTML MUST enlazarlo con `<link rel="manifest">`.

#### Scenario: Iconos con el tamaño declarado
- **WHEN** se leen los iconos declarados en el manifiesto
- **THEN** existen y sus dimensiones PNG coinciden con `192x192` y `512x512`

#### Scenario: Manifiesto enlazado
- **WHEN** se inspecciona el `<head>` de cada HTML de `site/`
- **THEN** contiene un `<link rel="manifest">` que apunta a `manifest.webmanifest`

#### Scenario: Publicado en Pages
- **WHEN** tras el despliegue se piden `404.html`, `robots.txt`, `sitemap.xml` y `manifest.webmanifest` bajo la base del sitio
- **THEN** cada petición responde 200
