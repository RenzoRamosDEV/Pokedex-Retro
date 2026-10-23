# 0003. Servidor MCP por stdio

- Estado: Aceptada
- Fecha: 2026-10-23

## Contexto

Se añade un servidor MCP que expone los datos de la Pokédex reutilizando `site/js/core` y `site/js/mappers`. El uso previsto es local, desde clientes de escritorio y de línea de comandos que lanzan el servidor como proceso hijo.

## Decisión

El servidor MCP usa el transporte stdio: el cliente lo arranca como proceso local y se comunica por entrada y salida estándar.

## Consecuencias

- No hay servidor que desplegar, mantener ni proteger; no se abren puertos.
- Los registros deben ir a `stderr` para no corromper el protocolo en `stdout`.
- Usarlo en remoto exigiría añadir otro transporte más adelante.

## Alternativas

- HTTP streamable: descartada; exige alojar y proteger un servicio para un uso que es local.
- SSE: descartada; transporte HTTP heredado con las mismas necesidades de alojamiento.
