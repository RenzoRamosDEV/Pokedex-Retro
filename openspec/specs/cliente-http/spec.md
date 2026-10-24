# cliente-http Specification

## Purpose
Obtener JSON de PokéAPI desde la web de forma robusta: reintentos acotados ante fallos transitorios, plazo máximo, cancelación por el llamante y una caché inyectable, sin dependencias de runtime.

## Requirements

### Requirement: Fábrica de cliente con dependencias inyectables
El cliente HTTP SHALL crearse con `createFetchJson({ fetch, cache, timeoutMs = 10000, retries = 2 })`, que devuelve `fetchJson(url, { signal } = {})`. `fetch` MUST poder sustituirse por un doble (por defecto `globalThis.fetch`) y `cache` es opcional. Ante una respuesta 2xx, `fetchJson` SHALL resolver con el cuerpo JSON ya interpretado.

#### Scenario: Respuesta correcta
- **WHEN** se llama a `fetchJson(url)` con un `fetch` falso que responde 200 con `{"id":1}`
- **THEN** resuelve con `{ id: 1 }` tras exactamente 1 llamada a `fetch`

#### Scenario: Importable sin navegador
- **WHEN** se importa el módulo del cliente en Node sin `window` ni `document`
- **THEN** la importación no lanza ni realiza ninguna petición

### Requirement: Reintentos acotados ante fallos transitorios
`fetchJson` SHALL reintentar solo ante error de red, HTTP 429 y HTTP 5xx, como máximo `retries` veces, esperando `500 ms × 2^intento` antes de cada reintento (500 ms y 1000 ms con los valores por defecto). Agotados los reintentos, MUST rechazar con el último error.

#### Scenario: Reintento ante 503
- **WHEN** se llama a `fetchJson(url)` con un `fetch` falso que responde 503 y luego 200
- **THEN** resuelve con el JSON del 200 tras exactamente 2 llamadas, separadas por 500 ms de espera

#### Scenario: Reintento ante error de red y 429
- **WHEN** el `fetch` falso lanza un `TypeError`, luego responde 429 y luego 200
- **THEN** resuelve con el JSON del 200 tras exactamente 3 llamadas, con esperas de 500 ms y 1000 ms

#### Scenario: Reintentos agotados
- **WHEN** el `fetch` falso responde 500 en todas las llamadas con `retries = 2`
- **THEN** rechaza tras exactamente 3 llamadas con un error que expone `status` 500

#### Scenario: Reintentos desactivados
- **WHEN** se crea el cliente con `retries = 0` y el `fetch` falso responde 503
- **THEN** rechaza tras exactamente 1 llamada

### Requirement: Sin reintento ante errores definitivos
`fetchJson` MUST rechazar sin reintentar ante cualquier respuesta 4xx distinta de 429, exponiendo el código HTTP en la propiedad `status` del error.

#### Scenario: Sin reintento ante 404
- **WHEN** se llama a `fetchJson(url)` con un `fetch` falso que responde 404
- **THEN** rechaza tras exactamente 1 llamada con un error cuyo `status` es 404

### Requirement: Cancelación por el llamante
Si la señal `signal` recibida está abortada o se aborta durante la petición o durante una espera entre reintentos, `fetchJson` MUST rechazar con un error cuyo `name` es `AbortError`, sin nuevas llamadas a `fetch`.

#### Scenario: Señal ya abortada
- **WHEN** se llama a `fetchJson(url, { signal })` con una señal ya abortada
- **THEN** rechaza con `AbortError` sin llamar a `fetch`

#### Scenario: Aborto durante la espera de reintento
- **WHEN** el `fetch` falso responde 503 y la señal se aborta durante la espera de 500 ms
- **THEN** rechaza con `AbortError` tras exactamente 1 llamada a `fetch`

### Requirement: Plazo máximo
Si la llamada completa a `fetchJson` (peticiones y esperas incluidas) supera `timeoutMs`, MUST rechazar con un error cuyo `name` es `TimeoutError` y abortar la petición en curso.

#### Scenario: Petición que no responde
- **WHEN** el `fetch` falso no resuelve nunca y transcurren `timeoutMs` milisegundos
- **THEN** `fetchJson` rechaza con `TimeoutError` y la señal entregada a `fetch` queda abortada

### Requirement: Caché inyectable opcional
Si se proporciona `cache` (con `get(url)` y `set(url, valor)`), `fetchJson` SHALL devolver el valor guardado para la URL sin llamar a `fetch` y SHALL guardar cada respuesta correcta. Sin `cache`, cada llamada MUST ir a la red.

#### Scenario: Acierto de caché
- **WHEN** se llama dos veces a `fetchJson(url)` con `cache` igual a un `Map` vacío y un `fetch` falso que responde 200
- **THEN** ambas llamadas resuelven con el mismo JSON y `fetch` se invoca exactamente 1 vez

#### Scenario: Errores no se guardan
- **WHEN** el `fetch` falso responde 404 con `cache` igual a un `Map` vacío
- **THEN** la caché sigue vacía

### Requirement: Caché persistente de listas completas
La web SHALL guardar cada respuesta correcta de una URL con `limit=100000` en `localStorage`, clave `pokedex:lista:<url>` y valor `{ "t": <epoch ms>, "data": <json> }`, y SHALL reutilizarla sin petición mientras `ahora - t < 86 400 000` ms. Una entrada caducada MUST ignorarse, pedirse de nuevo a la red y sobrescribirse.

#### Scenario: Búsqueda con lista en caché
- **WHEN** `pokedex:lista:https://pokeapi.co/api/v2/pokemon?limit=100000` se guardó hace 2 h y el usuario busca `char`
- **THEN** no se hace ninguna petición a esa URL

#### Scenario: Lista caducada
- **WHEN** la misma entrada se guardó hace 25 h y el usuario busca `char`
- **THEN** se vuelve a pedir la lista y la entrada se sobrescribe con el nuevo `t` y los nuevos datos

#### Scenario: Límite exacto de caducidad
- **WHEN** la entrada se guardó hace exactamente 86 400 000 ms
- **THEN** se considera caducada y se pide a la red

### Requirement: Caché de detalles por sesión
La web SHALL guardar cada respuesta correcta de cualquier URL que no sea de lista completa en memoria y en `sessionStorage` bajo `pokedex:detalle:<url>`, sin caducidad, y SHALL reutilizarla sin petición durante la sesión del navegador, también tras recargar la página.

#### Scenario: Detalle repetido
- **WHEN** se pide dos veces `https://pokeapi.co/api/v2/pokemon/charmander` en la misma página
- **THEN** solo se hace una petición de red

#### Scenario: Detalle tras recargar
- **WHEN** `pokedex:detalle:https://pokeapi.co/api/v2/pokemon/charmander` existe en `sessionStorage` y la página se recarga
- **THEN** ese detalle se usa sin petición de red

### Requirement: Caché tolerante a fallos de almacenamiento
Si el almacenamiento no está disponible, lanza al leer o escribir (modo privado, `QuotaExceededError`) o contiene una entrada que no es JSON válido con la forma esperada, la web MUST tratar la entrada como ausente, pedir a la red, intentar sobrescribirla y pintar la página normalmente, sin mensaje de error ni excepción visible.

#### Scenario: Almacenamiento lleno
- **WHEN** `localStorage.setItem` lanza `QuotaExceededError` al cargar una lista
- **THEN** la página se pinta normalmente sin mensaje de error

#### Scenario: Entrada corrupta
- **WHEN** `pokedex:lista:<url>` contiene un texto que no es JSON válido
- **THEN** se pide la lista a la red y la entrada se sobrescribe con un valor válido

#### Scenario: Almacenamiento inaccesible
- **WHEN** acceder a `localStorage` o `sessionStorage` lanza `SecurityError`
- **THEN** cada carga va a la red y la página se pinta normalmente

### Requirement: Espera indicada por Retry-After
Ante un 429 reintentable cuya respuesta expone `Retry-After` válido (segundos enteros ≥ 0 o fecha HTTP), `fetchJson` SHALL esperar ese tiempo (0 si la fecha ya pasó) en lugar de `500 ms × 2^intento`; sin cabecera, con un valor no válido o en respuestas 5xx MUST usar la espera exponencial. El plazo máximo y la cancelación se aplican igual durante esa espera.

#### Scenario: Retry-After en segundos
- **WHEN** el `fetch` falso responde 429 con `Retry-After: 1` y luego 200
- **THEN** resuelve con el JSON del 200 tras exactamente 2 llamadas, sin segunda llamada antes de 1000 ms

#### Scenario: Retry-After como fecha
- **WHEN** el `fetch` falso responde 429 con `Retry-After` igual a la fecha HTTP de dentro de 2 s y luego 200
- **THEN** la segunda llamada ocurre a los 2000 ms y no antes

#### Scenario: Valor no válido
- **WHEN** el `fetch` falso responde 429 con `Retry-After: pronto` y luego 200
- **THEN** la segunda llamada ocurre a los 500 ms

#### Scenario: Sin cabeceras
- **WHEN** la respuesta falsa no tiene `headers`
- **THEN** la espera es la exponencial y no se lanza ningún error por la ausencia

#### Scenario: Espera más larga que el plazo
- **WHEN** el `fetch` falso responde 429 con `Retry-After: 60` y `timeoutMs` es 10000
- **THEN** `fetchJson` rechaza con `TimeoutError` a los 10000 ms tras exactamente 1 llamada
