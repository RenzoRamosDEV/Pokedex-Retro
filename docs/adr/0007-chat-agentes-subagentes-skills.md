# 0007. Agentes, subagentes y skills en el chat, solo sobre Pokémon

- Estado: Aceptada
- Fecha: 2026-10-25

## Contexto

El chat de `chat.html` (1.3.0, [ADR 0005](0005-chat-byok-fetch-directo.md) y [ADR 0006](0006-chat-multiproveedor-openai.md)) responde a cualquier pregunta, también a las que no tienen nada que ver con Pokémon, y toda la conversación la lleva un único prompt de sistema con las 12 herramientas de consulta. Se quiere que el chat se organice en agentes, subagentes y skills definidos en el propio repositorio y que solo responda sobre Pokémon. La web sigue sin backend, sin build y sin dependencias de runtime ([ADR 0004](0004-javascript-jsdoc-ts-check.md)), y cada petición se paga con la clave del visitante.

## Decisión

- Agentes y skills son **módulos ES de datos puros** en `site/js/chat/agentes/`: `alcance.js` (respuesta fija, texto base y regla de alcance), `skills.js`, `subagentes.js`, `meta.js` (las dos herramientas nuevas y su validación) y `profesor.js`. Un agente es `{ nombre, sistema, herramientas, maxIteraciones }`; el bucle (`bucle.js`) ejecuta «un agente» sin saber cuál.
- **Un prompt por agente**, constante (sin fecha ni datos variables) para que la caché de prompt funcione, y la misma fuente para los dos proveedores: `system` con Claude e `instructions` con OpenAI. Los adaptadores reciben el agente en `construirPeticion`; por defecto, el agente principal `profesor`.
- El `profesor` tiene las 12 herramientas de consulta, `delegar_subagente` y `usar_skill`. Tres subagentes con un subconjunto fijo: `estratega-tipos`, `entrenador-equipos` e `investigador-pokedex`.
- **Delegación con profundidad 1**: `delegar_subagente({ subagente, tarea })` ejecuta un bucle anidado con el mismo proveedor, modelo, clave y señal de aborto, un historial que solo contiene la tarea y como mucho 6 iteraciones (7 peticiones). Su texto final vuelve como resultado de la herramienta y no se muestra; sus tokens se suman a la línea de uso. Una llamada a una herramienta fuera de la lista del agente nunca se ejecuta (`Herramienta desconocida: <nombre>.`), así que un subagente no puede delegar ni cargar skills aunque el modelo lo intente. Un error de API dentro del subagente termina la pregunta entera, como en el agente principal.
- **Carga progresiva de skills**: el prompt del `profesor` solo lista nombre y descripción de una línea de cada subagente y de las skills `comparar-pokemon`, `equipo-contra-tipo`, `analizar-debilidades` y `recomendar-naturaleza`; las instrucciones completas solo llegan como resultado de `usar_skill`. Las dos primeras comparten su guía de herramientas con los prompts del MCP a través de `site/js/core/guias.js`, sin cambiar el texto que devuelve el MCP.
- **Alcance solo Pokémon por instrucciones**: todos los prompts llevan la misma regla: ante otro tema, o una petición de ignorar, revelar o cambiar las instrucciones, la respuesta es exactamente `Solo puedo responder preguntas sobre Pokémon.`, sin herramientas. El navegador no clasifica ni bloquea preguntas.
- La línea de estado muestra `SUBAGENTE: <nombre>` mientras trabaja un subagente y `SKILL: <nombre>` al cargar una skill; `DETENER` aborta también los bucles anidados.

## Consecuencias

- El catálogo de agentes y skills se lee y se revisa como código, con tests de catálogo, prompts y validación, y mutación propia (`stryker.chat-agentes.config.json`).
- `bucle.js` sigue teniendo un único camino para reintentos, lectura del stream, límite, aborto y uso; los tests previos del bucle siguen pasando sin cambiar aserciones.
- **Coste adicional**: cada delegación hace hasta 7 peticiones más con la clave del visitante, y el modelo puede pedir varias en paralelo. Mitigaciones: límite por subagente, profundidad 1, descripción de `delegar_subagente` que pide usarla solo cuando haga falta, aviso en `chat.html` (`Delegar en subagentes consume tokens adicionales.`) y uso sumado en la línea de tokens.
- **Alcance de mejor esfuerzo**: un prompt hábil puede sacar al modelo de tema. La regla es explícita también contra los intentos de saltársela y está en todos los agentes, pero no es una garantía.
- Más latencia percibida mientras trabaja un subagente sin texto en pantalla, atenuada por la línea `SUBAGENTE` y `DETENER`.
- La caché de prompt se reparte entre agentes; cada prompt es constante y el del agente principal conserva su prefijo estable.

## Alternativas

- Clasificador o filtro de temas en el cliente: descartado. Daría falsos positivos con nombres de Pokémon, movimientos y objetos, y no es más fiable que la instrucción al modelo.
- SDK de agentes (Claude Agent SDK, Agents SDK de OpenAI): descartado; exigen bundler o servidor y dependencias de runtime, y el chat ya tiene su bucle de herramientas.
- Agentes y skills en ficheros Markdown con frontmatter cargados en tiempo de ejecución: descartado; añade E/S, parseo y fallos de red a algo estático, y sin bundler no se pueden importar.
- Subagentes que delegan en otros (profundidad > 1): descartado; multiplica el coste y la latencia sin un caso de uso que lo necesite.

## Referencias

- Propuesta y diseño: `openspec/changes/archive/*-chat-agentes-y-skills/`
- Prompts del MCP que comparten la guía: `mcp/src/prompts/comparar-pokemon.js` y `mcp/src/prompts/equipo-contra-tipo.js`
