# Spec Delta

## ADDED Requirements

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
