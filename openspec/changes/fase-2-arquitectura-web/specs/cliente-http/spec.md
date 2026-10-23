# Spec Delta

## Purpose

Obtener JSON de PokéAPI desde la web de forma robusta: reintentos acotados ante fallos transitorios, plazo máximo, cancelación por el llamante y una caché inyectable, sin dependencias de runtime.

## ADDED Requirements

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
