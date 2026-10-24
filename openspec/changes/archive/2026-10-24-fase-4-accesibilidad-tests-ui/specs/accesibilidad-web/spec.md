# Spec Delta

## Purpose

Garantiza que la web publicada cumpla WCAG 2.1 AA: navegación completa por teclado, estados anunciados a lectores de pantalla, diálogo de detalle con foco gestionado, respeto de las preferencias del sistema y contraste suficiente en los tres temas.

## ADDED Requirements

### Requirement: Diálogo de detalle de Pokémon
El detalle de un Pokémon SHALL mostrarse en un diálogo modal nativo nombrado por el nombre del Pokémon (`aria-labelledby`). Al abrirse, el foco MUST ir al botón cerrar y el resto de la página MUST quedar inerte; Escape, el botón cerrar o un clic fuera del panel MUST cerrarlo. Al cerrarse, el foco MUST volver a la tarjeta de ese Pokémon. El diálogo MUST funcionar sin estilos, scripts ni manejadores en línea.

#### Scenario: Modal con teclado
- **WHEN** con la Pokédex cargada y el foco en la tarjeta de #25 se pulsa Enter y luego Escape
- **THEN** el diálogo se abre con el foco en el botón cerrar, se cierra, la URL no tiene hash y el foco vuelve a la tarjeta #25

#### Scenario: Cierre con el botón
- **WHEN** con el diálogo de #25 abierto y el foco en el botón cerrar se pulsa Enter
- **THEN** el diálogo se cierra y el foco vuelve a la tarjeta #25

#### Scenario: Clic en el fondo
- **WHEN** con el diálogo abierto se hace clic fuera del panel
- **THEN** el diálogo se cierra

#### Scenario: Nombre accesible
- **WHEN** se abre el diálogo de #25
- **THEN** su nombre accesible es el nombre del Pokémon

### Requirement: Enlace profundo al detalle
Abrir el diálogo de un Pokémon SHALL poner `#pokemon-<id>` en la URL sin añadir una entrada al historial; cerrarlo MUST quitar el hash conservando ruta y parámetros. Cargar una página cuyo hash es `#pokemon-<id>` MUST abrir ese diálogo si el Pokémon está en la página actual; si no está, la página MUST cargarse sin diálogo y sin error.

#### Scenario: Enlace profundo
- **WHEN** se carga `index.html?page=2#pokemon-25` y #25 está en la página actual
- **THEN** el diálogo de #25 está abierto

#### Scenario: Hash al abrir y cerrar
- **WHEN** en `index.html?q=pika` se abre el diálogo de #25 y luego se cierra
- **THEN** la URL pasa a `index.html?q=pika#pokemon-25` y vuelve a `index.html?q=pika`, sin nuevas entradas en el historial

#### Scenario: Pokémon fuera de la página
- **WHEN** se carga `index.html#pokemon-25` y #25 no está en la página actual
- **THEN** no se abre ningún diálogo y las tarjetas se muestran

### Requirement: Salto al contenido
Cada página de sección SHALL tener como primer elemento enfocable del `<body>` un enlace `Saltar al contenido` a `#contenido`, oculto salvo cuando tiene el foco. El `<main>` MUST llevar `id="contenido"` y `tabindex="-1"` para recibir el foco al activarlo.

#### Scenario: Primer Tab
- **WHEN** se carga cualquier página de sección y se pulsa Tab
- **THEN** el foco está en `Saltar al contenido` y el enlace es visible

#### Scenario: Activar el salto
- **WHEN** con el foco en `Saltar al contenido` se pulsa Enter
- **THEN** el foco pasa al `<main id="contenido">`

### Requirement: Desplegables anunciados y operables por teclado
Los botones de tema e información SHALL llevar `aria-expanded` con el estado real de su panel, `aria-controls` con el id del panel y `aria-haspopup="true"`. Abrir un desplegable MUST cerrar los demás; Escape MUST cerrar el desplegable abierto y devolver el foco a su botón; un clic fuera MUST cerrarlos todos sin dejar el foco en un panel oculto.

#### Scenario: Abrir con teclado
- **WHEN** con el foco en el botón de tema se pulsa Enter
- **THEN** el panel de temas es visible y el botón tiene `aria-expanded="true"`

#### Scenario: Escape
- **WHEN** con el panel de temas abierto se pulsa Escape
- **THEN** el panel se oculta, el botón tiene `aria-expanded="false"` y el foco está en el botón

#### Scenario: Un solo desplegable abierto
- **WHEN** con el panel de temas abierto se activa el botón de información
- **THEN** el panel de información es visible, el de temas está oculto y cada botón refleja su estado en `aria-expanded`

#### Scenario: Elegir tema
- **WHEN** con el panel de temas abierto se activa la opción `DMG` con el teclado
- **THEN** el tema cambia a `gb`, el panel se oculta y el foco vuelve al botón de tema

### Requirement: Menú móvil operable por teclado
El control que despliega la navegación SHALL ser un botón enfocable con nombre accesible, `aria-expanded` con el estado real del menú y `aria-controls` con el id de la navegación. El menú MUST abrirse y cerrarse con Enter o Espacio, cerrarse con Escape devolviendo el foco al botón, y conservar su aspecto (icono que pasa a X y menú desplegado).

#### Scenario: Abrir el menú
- **WHEN** con el foco en el botón de menú se pulsa Enter
- **THEN** la navegación es visible y el botón tiene `aria-expanded="true"`

#### Scenario: Cerrar con Escape
- **WHEN** con el menú abierto se pulsa Escape
- **THEN** la navegación se oculta, el botón tiene `aria-expanded="false"` y el foco está en el botón

### Requirement: Región de estado
Los mensajes de carga, sin resultados, error de carga y elementos no cargados SHALL mostrarse en un único contenedor persistente con `role="status"` y `aria-live="polite"` presente en el HTML de cada página de sección; su texto MUST cambiar sin recrear el contenedor y quedar vacío cuando la sección carga sin incidencias.

#### Scenario: Carga correcta
- **WHEN** una sección carga todos sus elementos
- **THEN** la región de estado existe y está vacía

#### Scenario: Sin resultados
- **WHEN** una búsqueda no encuentra nada
- **THEN** la región de estado contiene `SIN RESULTADOS`

#### Scenario: Error de carga
- **WHEN** falla la petición de la lista
- **THEN** la región de estado contiene el mensaje de error de carga

### Requirement: Aviso sin JavaScript
Cada página de sección SHALL incluir un `<noscript>` con el texto `ESTA POKÉDEX NECESITA JAVASCRIPT` dentro del contenido principal.

#### Scenario: Navegador sin JavaScript
- **WHEN** se inspecciona el HTML de cada página de sección
- **THEN** contiene un `<noscript>` con `ESTA POKÉDEX NECESITA JAVASCRIPT`

### Requirement: Movimiento reducido
Con `prefers-reduced-motion: reduce`, la web MUST NOT ejecutar transiciones ni animaciones.

#### Scenario: Preferencia de movimiento reducido
- **WHEN** se carga la Pokédex con `prefers-reduced-motion: reduce`
- **THEN** la duración calculada de las transiciones y animaciones de tarjetas, botones y barras es `0s`

### Requirement: Contraste AA en los tres temas
Todo texto SHALL tener un contraste de al menos 4,5:1 con su fondo, o 3:1 si mide al menos 24 px o 18,66 px en negrita, en los temas `normal`, `gb` y `gray`. Los ajustes MUST conservar la paleta de cada tema (verde en `gb`).

#### Scenario: Tema DMG
- **WHEN** se audita con axe cualquier página de sección en el tema `gb`
- **THEN** no hay violaciones de contraste

#### Scenario: Auditoría por página y tema
- **WHEN** se audita con axe cada una de las 7 páginas de sección en cada tema, y la Pokédex con el diálogo abierto
- **THEN** no hay ninguna violación de impacto `serious` ni `critical`

### Requirement: Controles con nombre accesible
Todo control interactivo generado por la interfaz SHALL tener nombre accesible (incluidos el campo y el botón de búsqueda), y toda zona con desplazamiento propio MUST poder enfocarse con el teclado y tener nombre. Los textos MUST venir del objeto de textos de la interfaz.

#### Scenario: Buscador
- **WHEN** se pinta la cabecera de una sección con búsqueda
- **THEN** el campo y el botón tienen nombre accesible no vacío

#### Scenario: Tabla de tipos desplazable
- **WHEN** se pinta la tabla de tipos
- **THEN** su contenedor desplazable es enfocable y tiene nombre accesible
