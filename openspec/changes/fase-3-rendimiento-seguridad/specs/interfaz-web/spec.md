# Spec Delta

## ADDED Requirements

### Requirement: Detalles con concurrencia limitada
Al cargar una página de una sección, las peticiones de detalle de sus elementos MUST ejecutarse con como máximo 6 en vuelo a la vez; cada petición nueva SHALL empezar en cuanto termine (bien o mal) una de las anteriores, y el fallo de una MUST NOT detener las demás.

#### Scenario: Concurrencia
- **WHEN** se carga una página con 18 detalles y un cliente falso que registra las peticiones simultáneas
- **THEN** el máximo de peticiones simultáneas registrado es 6 y se completan las 18

#### Scenario: Menos detalles que el límite
- **WHEN** se carga una página con 4 detalles
- **THEN** las 4 peticiones se lanzan a la vez

### Requirement: Aviso de elementos no cargados
Si fallan N > 0 detalles de una página, la sección SHALL pintarse con los elementos que sí cargaron y añadir un aviso con `role="status"` y el texto `N ELEMENTOS NO SE PUDIERON CARGAR`, o `1 ELEMENTO NO SE PUDO CARGAR` si N = 1, definido junto al resto de textos de la interfaz. Si fallan todos, MUST mostrarse solo el aviso, no `SIN RESULTADOS`.

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
