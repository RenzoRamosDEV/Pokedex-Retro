# interfaz-web Specification

## Purpose
Define el comportamiento observable de las 7 páginas de la web: carga de datos cancelable, selector de tema, textos de interfaz en español, versión visible, marca de página activa y metadatos.

## Requirements

### Requirement: Carga cancelable al salir de la página
Cada carga de datos de una página SHALL usar su propia señal de cancelación, que MUST abortarse al dispararse `pagehide`. Una carga abortada MUST NOT pintar el mensaje de error ni sustituir el contenido.

#### Scenario: Navegación durante la carga
- **WHEN** hay una carga en curso y se dispara `pagehide`
- **THEN** las peticiones pendientes se abortan y no se pinta el mensaje de error

#### Scenario: Carga completada
- **WHEN** la carga termina antes de cualquier `pagehide`
- **THEN** se pinta el resultado (contenido, `SIN RESULTADOS` o el mensaje de error) como hasta ahora

#### Scenario: Vuelta desde la caché de navegación
- **WHEN** una página cuya carga se abortó por `pagehide` se restaura con `pageshow` persistente
- **THEN** la carga se repite y la página no queda en `CARGANDO...`

### Requirement: Tema sin efectos al importar
El módulo de tema MUST NOT acceder al DOM ni al almacenamiento al importarse; SHALL exponer `initTheme(document, storage)`, que aplica el tema guardado y conecta los botones de tema e información. La página SHALL invocarla al arrancar.

#### Scenario: Importación sin DOM
- **WHEN** se importa el módulo de tema en Node sin `document`
- **THEN** la importación no lanza

#### Scenario: Tema guardado
- **WHEN** se llama a `initTheme` con un almacenamiento cuya clave `theme` vale `gb`
- **THEN** `body` queda con `data-theme="gb"` y solo la opción `gb` tiene la clase `active`

### Requirement: Persistencia del tema
El tema SHALL guardarse en la clave `theme` con valores `normal`, `gb` o `gray`, y por defecto MUST ser `normal`. Si el almacenamiento no existe o lanza al leer o escribir, el tema MUST aplicarse igualmente sin persistir.

#### Scenario: Sin preferencia guardada
- **WHEN** se llama a `initTheme` con un almacenamiento vacío
- **THEN** `body` queda con `data-theme="normal"`

#### Scenario: Almacenamiento que lanza
- **WHEN** `getItem` y `setItem` lanzan y el usuario elige la opción `gray`
- **THEN** `body` queda con `data-theme="gray"` y no se propaga ninguna excepción

### Requirement: Textos de interfaz centralizados
Todos los textos visibles generados desde JavaScript (contenido, `aria-label`, `placeholder`, `title` y `alt` fijos) SHALL definirse en un único objeto congelado; los módulos de renderizado, el de maquetación y el de arranque MUST NOT contener literales de texto visibles.

#### Scenario: Objeto inmutable
- **WHEN** se intenta modificar o añadir una entrada del objeto de textos, en cualquier nivel
- **THEN** el valor no cambia

#### Scenario: Literal visible fuera del objeto
- **WHEN** un módulo de renderizado contiene un literal con texto visible
- **THEN** `npm test` falla indicando el fichero

### Requirement: Textos en español
La etiqueta de habilidad oculta SHALL mostrarse como `OCULTA` y los botones de paginación como `◀ ANT.` y `SIG. ▶`. El resto de textos visibles MUST conservarse sin cambios.

#### Scenario: Paginación
- **WHEN** se pinta la navegación de una página intermedia
- **THEN** los botones muestran `◀ ANT.` y `SIG. ▶` y no aparecen `PREV` ni `NEXT`

#### Scenario: Habilidad oculta
- **WHEN** se pinta la ficha de un Pokémon con una habilidad oculta
- **THEN** la habilidad lleva la etiqueta `OCULTA` y no aparece `HIDDEN`

### Requirement: Versión visible
El panel INFO SHALL mostrar la versión publicada de la aplicación, igual a `version` de `package.json`, rellenada desde JavaScript; los HTML MUST NOT contener una versión fija.

#### Scenario: Panel INFO
- **WHEN** se abre el panel INFO de cualquier página con `package.json` en `1.0.0`
- **THEN** la fila VERSIÓN muestra `1.0.0`

### Requirement: Marca de página activa
En la navegación de cada una de las 7 páginas, el enlace a la propia página SHALL llevar `aria-current="page"` y la clase `active`; ningún otro enlace MUST llevarlos. La cabecera y la navegación siguen escritas en cada HTML (ADR 0001).

#### Scenario: Página de tipos
- **WHEN** se carga `tipos.html`
- **THEN** solo el enlace `tipos.html` de la navegación tiene `aria-current="page"` y la clase `active`

### Requirement: Metadatos fieles al contenido
La meta `description` de las 7 páginas MUST NOT mencionar contenidos que la web no muestra, en particular "cadenas evolutivas".

#### Scenario: Descripción de la página
- **WHEN** se busca "cadenas evolutivas" en los 7 HTML de `site/`
- **THEN** no hay ninguna coincidencia
