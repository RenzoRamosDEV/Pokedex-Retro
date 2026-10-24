# Spec Delta

## ADDED Requirements

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

### Requirement: Precarga del grafo de módulos
Cada página HTML que carga `js/ui/main.js` SHALL declarar, antes de ese `<script>`, un `<link rel="modulepreload">` por cada módulo que `main.js` importa de forma estática, directa o transitivamente, y ninguno más. Las rutas MUST ser relativas al mismo origen, compatibles con la CSP vigente.

#### Scenario: Lista sincronizada
- **WHEN** se añade o elimina una importación estática en un módulo alcanzable desde `main.js` sin actualizar los HTML
- **THEN** `npm test` falla nombrando la página y los módulos que sobran o faltan

#### Scenario: Sin precargas obsoletas
- **WHEN** un HTML precarga un módulo que ya no forma parte del grafo
- **THEN** `npm test` falla
