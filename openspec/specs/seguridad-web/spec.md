# seguridad-web Specification

## Purpose
Endurecer la web publicada en GitHub Pages: una política de seguridad de contenidos sin excepciones en línea, HTML sin estilos, scripts ni manejadores en línea y recursos servidos solo desde el propio origen o desde los orígenes de datos autorizados.

## Requirements

### Requirement: Política de seguridad de contenidos
Cada página HTML de `site/` SHALL incluir en su `<head>`, antes de cualquier hoja de estilos o script, una `<meta http-equiv="Content-Security-Policy">` con el contenido exacto indicado en el escenario «Política presente en todas las páginas». La política MUST NOT contener `'unsafe-inline'` ni `'unsafe-eval'`.

#### Scenario: Política presente en todas las páginas
- **WHEN** se inspecciona el `<head>` de cada HTML de `site/`, incluida la página 404
- **THEN** contiene exactamente una meta `Content-Security-Policy` con el contenido `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' https://raw.githubusercontent.com; connect-src https://pokeapi.co https://api.anthropic.com; manifest-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`

#### Scenario: Orígenes de conexión exactos
- **WHEN** se lee la directiva `connect-src` de cualquier página
- **THEN** contiene exactamente `https://pokeapi.co https://api.anthropic.com`, en ese orden y sin más orígenes

#### Scenario: Navegación real sin violaciones
- **WHEN** se carga `index.html?q=char` en un navegador contra PokéAPI real y se abre una ficha
- **THEN** la consola no muestra ninguna violación de la política de seguridad de contenidos

#### Scenario: Chat real sin violaciones
- **WHEN** se carga `chat.html` en un navegador y se envía una pregunta a la API real de Claude con una clave inválida
- **THEN** la consola no muestra ninguna violación de la política de seguridad de contenidos

### Requirement: HTML sin código ni estilos en línea
Ni los HTML de `site/` ni el HTML que generan los módulos de renderizado MUST contener atributos `style`, elementos `<script>` sin atributo `src` ni atributos de manejador de eventos (`on*=`). `npm test` SHALL fallar nombrando el origen si encuentra alguno.

#### Scenario: Estilo en línea en un renderizado
- **WHEN** un módulo de renderizado produce, con datos de fixture, un elemento con `style="…"`
- **THEN** `npm test` falla indicando la vista afectada

#### Scenario: Páginas limpias
- **WHEN** se ejecuta `npm test` sobre los HTML de `site/` y la salida de todas las vistas con datos de fixture
- **THEN** no hay ningún `style=`, `<script>` en línea ni `on*=` y el test pasa

### Requirement: Barras de estadísticas sin estilos en línea
Cada barra de estadística SHALL llevar su anchura como `data-valor` con un entero de 0 a 100 (la estadística base limitada a 100), y la página MUST aplicarla mediante la propiedad CSS personalizada `--ancho` desde JavaScript, de modo que la barra se vea con ese porcentaje de anchura.

#### Scenario: Estadística por encima del máximo
- **WHEN** se pinta la ficha de un Pokémon con una estadística base de 150
- **THEN** su barra lleva `data-valor="100"` y ningún atributo `style`

#### Scenario: Anchura aplicada
- **WHEN** la página termina de pintar barras con `data-valor="45"`
- **THEN** cada una tiene `--ancho` igual a `45%`

### Requirement: Colores del acordeón de naturalezas por clase
La cabecera de cada grupo del acordeón de naturalezas SHALL llevar la clase `acc-stat-<estadistica>` (`attack`, `defense`, `special-attack`, `special-defense`, `speed`) o `acc-stat-neutral`, y su color de borde MUST definirse en la hoja de estilos, conservando los colores actuales y los ajustes de los temas `gb` y `gray`.

#### Scenario: Grupo de ataque
- **WHEN** se pinta la sección de naturalezas
- **THEN** la cabecera del grupo de ataque tiene la clase `acc-stat-attack` y ningún atributo `style`

### Requirement: Fuentes autoalojadas
Las fuentes Press Start 2P y VT323 SHALL servirse desde `site/fonts/` en formato `woff2`, acompañadas de su licencia SIL OFL 1.1 en `site/fonts/OFL.txt`, declaradas con `font-display: swap` y precargadas en cada HTML con `<link rel="preload" as="font" type="font/woff2" crossorigin>`. Ningún HTML ni hoja de estilos MUST referenciar `fonts.googleapis.com` ni `fonts.gstatic.com`.

#### Scenario: Sin Google Fonts
- **WHEN** se buscan `fonts.googleapis.com` y `fonts.gstatic.com` en `site/`
- **THEN** no hay ninguna coincidencia

#### Scenario: Fuentes cargadas del propio origen
- **WHEN** se carga cualquier página en un navegador
- **THEN** las dos fuentes se descargan desde `site/fonts/` del mismo origen y se aplican al texto
