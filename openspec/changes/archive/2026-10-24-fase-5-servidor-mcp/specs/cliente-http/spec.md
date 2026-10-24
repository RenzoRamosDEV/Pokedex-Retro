# Spec Delta

## ADDED Requirements

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
