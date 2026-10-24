# Spec Delta

## MODIFIED Requirements

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
