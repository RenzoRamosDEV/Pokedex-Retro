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
El módulo de tema MUST NOT acceder al DOM ni al almacenamiento al importarse; SHALL exponer `initTheme(document, storage, prefersDark)`, que aplica el tema inicial y conecta las opciones de tema. La apertura y el cierre de los desplegables de tema e información MUST NOT depender del módulo de tema. La página SHALL invocar `initTheme` al arrancar con la preferencia de esquema oscuro del sistema.

#### Scenario: Importación sin DOM
- **WHEN** se importa el módulo de tema en Node sin `document`
- **THEN** la importación no lanza

#### Scenario: Tema guardado
- **WHEN** se llama a `initTheme` con un almacenamiento cuya clave `theme` vale `gb`
- **THEN** `body` queda con `data-theme="gb"` y solo la opción `gb` tiene la clase `active`

### Requirement: Persistencia del tema
El tema SHALL guardarse en la clave `theme` con valores `normal`, `gb` o `gray` cuando el usuario elige una opción. Sin tema guardado, el inicial MUST ser `gray` si el sistema prefiere esquema oscuro y `normal` en otro caso, y MUST NOT guardarse. Si el almacenamiento no existe o lanza al leer o escribir, el tema MUST aplicarse igualmente sin persistir.

#### Scenario: Sin preferencia guardada
- **WHEN** se llama a `initTheme` con un almacenamiento vacío y sin preferencia de esquema oscuro
- **THEN** `body` queda con `data-theme="normal"` y el almacenamiento sigue vacío

#### Scenario: Tema inicial oscuro
- **WHEN** sin clave `theme` en `localStorage` y con `prefers-color-scheme: dark` se carga cualquier página
- **THEN** `body` tiene `data-theme="gray"`

#### Scenario: Tema guardado prevalece
- **WHEN** la clave `theme` vale `normal` y el sistema prefiere esquema oscuro
- **THEN** `body` queda con `data-theme="normal"`

#### Scenario: Elección persistida
- **WHEN** el usuario elige la opción `gb` y recarga la página
- **THEN** `body` tiene `data-theme="gb"`

#### Scenario: Almacenamiento que lanza
- **WHEN** `getItem` y `setItem` lanzan y el usuario elige la opción `gray`
- **THEN** `body` queda con `data-theme="gray"` y no se propaga ninguna excepción

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

### Requirement: Detalles con concurrencia limitada
Al cargar una página de una sección, las peticiones de detalle de sus elementos MUST ejecutarse con como máximo 6 en vuelo a la vez; cada petición nueva SHALL empezar en cuanto termine (bien o mal) una de las anteriores, y el fallo de una MUST NOT detener las demás.

#### Scenario: Concurrencia
- **WHEN** se carga una página con 18 detalles y un cliente falso que registra las peticiones simultáneas
- **THEN** el máximo de peticiones simultáneas registrado es 6 y se completan las 18

#### Scenario: Menos detalles que el límite
- **WHEN** se carga una página con 4 detalles
- **THEN** las 4 peticiones se lanzan a la vez

### Requirement: Aviso de elementos no cargados
Si fallan N > 0 detalles de una página, la sección SHALL pintarse con los elementos que sí cargaron y mostrar en la región de estado (`role="status"`) el texto `N ELEMENTOS NO SE PUDIERON CARGAR`, o `1 ELEMENTO NO SE PUDO CARGAR` si N = 1, definido junto al resto de textos de la interfaz. Si fallan todos, MUST mostrarse solo el aviso, no `SIN RESULTADOS`.

#### Scenario: Fallos parciales
- **WHEN** se pinta una página con 18 detalles de los que 2 fallan
- **THEN** se muestran 16 tarjetas y el aviso `2 ELEMENTOS NO SE PUDIERON CARGAR`

#### Scenario: Un único fallo
- **WHEN** falla 1 detalle de la página
- **THEN** el aviso dice `1 ELEMENTO NO SE PUDO CARGAR`

#### Scenario: Sin fallos
- **WHEN** cargan todos los detalles
- **THEN** no se pinta ningún aviso de elementos no cargados

#### Scenario: Todos fallan
- **WHEN** fallan los 18 detalles de la página
- **THEN** se pinta el aviso `18 ELEMENTOS NO SE PUDIERON CARGAR` y no `SIN RESULTADOS`

### Requirement: Imágenes con dimensiones y carga diferida
Todo `<img>` generado por la interfaz SHALL llevar `width` y `height` con las dimensiones intrínsecas del sprite, `loading="lazy"` y `decoding="async"`. Una imagen de logotipo visible sobre la línea de flotación MUST NOT llevar `loading="lazy"`.

#### Scenario: Tarjeta de Pokémon
- **WHEN** se pinta la tarjeta de un Pokémon con sprite
- **THEN** su `<img>` tiene `width="96"`, `height="96"`, `loading="lazy"` y `decoding="async"`

#### Scenario: Objeto de la tienda
- **WHEN** se pinta una fila de objeto con sprite
- **THEN** su `<img>` tiene `width="30"`, `height="30"`, `loading="lazy"` y `decoding="async"`

### Requirement: Tabla de tipos sin pseudotipos
La sección TIPOS SHALL mostrar solo los tipos con relaciones de daño: MUST excluir `stellar`, `unknown` y `shadow` aunque PokéAPI los liste, y MUST NOT pedir su detalle. La web y el servidor MCP SHALL usar la misma lista de exclusión.

#### Scenario: PokéAPI lista los 21 tipos
- **WHEN** la lista de tipos de PokéAPI contiene los 18 tipos de combate más `stellar`, `unknown` y `shadow`
- **THEN** la tabla de `tipos.html` tiene 18 filas y 18 columnas y no pide `type/stellar`, `type/unknown` ni `type/shadow`

#### Scenario: Misma exclusión en el MCP
- **WHEN** el servidor MCP carga la tabla de tipos
- **THEN** excluye exactamente los mismos tipos que la web

### Requirement: Precio de los objetos
El precio de un objeto SHALL ser `cost` si PokéAPI lo devuelve como número (incluido `0`); si no, el `purchase_price` de la última entrada de `prices` con moneda `poke-dollar` y `purchase_price` mayor que 0; si no hay ninguna, `null`. El mismo precio SHALL usarse en la sección OBJETOS de la web y en el campo `cost` de las tools de objetos del MCP.

#### Scenario: Ultra Ball real
- **WHEN** se mapea la respuesta real de `item/ultra-ball`, sin `cost` y con 24 precios en `poke-dollar` cuyo último `purchase_price` es 600
- **THEN** el precio es 600 y la web pinta `600 ₽`

#### Scenario: Sin precios
- **WHEN** el objeto no tiene `cost` y `prices` está vacío o falta
- **THEN** el precio es `null` y la web pinta `—`

#### Scenario: Precios sin compra
- **WHEN** todas las entradas en `poke-dollar` tienen `purchase_price` `null` o `0`
- **THEN** el precio es `null`

#### Scenario: Otras monedas
- **WHEN** la última entrada con `purchase_price` positivo usa una moneda distinta de `poke-dollar`
- **THEN** se ignora y se usa la última entrada válida en `poke-dollar`

#### Scenario: Compatibilidad con cost
- **WHEN** PokéAPI devuelve `cost` numérico, aunque también haya `prices`
- **THEN** el precio es `cost`

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
