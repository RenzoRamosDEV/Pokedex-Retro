# Spec Delta

## ADDED Requirements

### Requirement: Enlace al chat en la navegación
La navegación de las 8 páginas (`index.html`, `movimientos.html`, `tipos.html`, `habilidades.html`, `naturalezas.html`, `objetos.html`, `bayas.html` y `chat.html`) SHALL incluir, tras `BAYAS`, el enlace `CHAT` a `chat.html`.

#### Scenario: Enlace en una página de sección
- **WHEN** se abre el menú de navegación en `tipos.html`
- **THEN** el último enlace es `CHAT` y apunta a `chat.html`

### Requirement: Número de secciones en el panel INFO
La fila `SECCIONES` del panel INFO de las 8 páginas SHALL mostrar `8`.

#### Scenario: Panel INFO
- **WHEN** se abre el panel INFO de cualquiera de las 8 páginas
- **THEN** la fila `SECCIONES` muestra `8`

## MODIFIED Requirements

### Requirement: Marca de página activa
En la navegación de cada una de las 8 páginas, el enlace a la propia página SHALL llevar `aria-current="page"` y la clase `active`; ningún otro enlace MUST llevarlos. La cabecera y la navegación siguen escritas en cada HTML (ADR 0001).

#### Scenario: Página de tipos
- **WHEN** se carga `tipos.html`
- **THEN** solo el enlace `tipos.html` de la navegación tiene `aria-current="page"` y la clase `active`

#### Scenario: Página del chat
- **WHEN** se carga `chat.html`
- **THEN** solo el enlace `CHAT` de la navegación tiene `aria-current="page"` y la clase `active`

### Requirement: Metadatos fieles al contenido
La meta `description` de las 8 páginas MUST NOT mencionar contenidos que la web no muestra, en particular "cadenas evolutivas".

#### Scenario: Descripción de la página
- **WHEN** se busca "cadenas evolutivas" en los 8 HTML de navegación de `site/`
- **THEN** no hay ninguna coincidencia

### Requirement: Textos de interfaz centralizados
Todos los textos visibles generados desde JavaScript (contenido, `aria-label`, `placeholder`, `title` y `alt` fijos) SHALL definirse en un único objeto congelado; los módulos de renderizado, el de maquetación, los de arranque y los de interfaz del chat MUST NOT contener literales de texto visibles.

#### Scenario: Objeto inmutable
- **WHEN** se intenta modificar o añadir una entrada del objeto de textos, en cualquier nivel
- **THEN** el valor no cambia

#### Scenario: Literal visible fuera del objeto
- **WHEN** un módulo de renderizado contiene un literal con texto visible
- **THEN** `npm test` falla indicando el fichero

#### Scenario: Literal visible en el chat
- **WHEN** un módulo de interfaz del chat contiene un literal con texto visible, como `CONSULTANDO: `
- **THEN** `npm test` falla indicando el fichero
