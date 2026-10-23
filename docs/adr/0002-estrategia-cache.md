# 0002. Estrategia de caché

- Estado: Aceptada
- Fecha: 2026-10-23

## Contexto

Cada búsqueda descarga de nuevo la lista completa de la sección (`limit=100000`) y los detalles se piden otra vez en cada navegación. PokéAPI es una API pública sin clave y el servidor MCP previsto hará peticiones similares. Hace falta reducir latencia y carga sobre la API sin añadir dependencias.

## Decisión

- Web, listas completas: `localStorage`, clave `pokedex:lista:<url>`, valor `{ t, data }` y TTL de 24 h.
- Web, detalles por URL: `Map` en memoria más `sessionStorage` (`pokedex:detalle:<url>`).
- La caché tolera JSON corrupto y `QuotaExceededError`: ante un fallo se ignora y se pide a la red.
- MCP: caché en memoria con TTL de 24 h; caché en disco solo si `POKEDEX_MCP_DISK_CACHE=1`.

## Consecuencias

- Las búsquedas repetidas no vuelven a descargar la lista completa durante 24 h.
- Los datos pueden ir hasta 24 h por detrás de PokéAPI, aceptable para datos que casi no cambian.
- El almacenamiento del navegador puede no estar disponible (modo privado, cuota); el código debe funcionar sin él.

## Alternativas

- Service Worker: descartada por ahora; añade ciclo de vida, actualización y depuración más complejos para el beneficio buscado.
- Sin caché: descartada; mantiene las descargas repetidas y la carga sobre PokéAPI.
- IndexedDB: descartada; API asíncrona más compleja para volúmenes que caben en `localStorage`.
