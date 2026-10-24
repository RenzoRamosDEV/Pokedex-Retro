# Propuesta: agentes, subagentes y skills en el chat, solo sobre Pokémon (versión 1.4.0)

## Why

El chat de `chat.html` (1.3.0) responde a cualquier pregunta, también a las que no tienen nada que ver con Pokémon, y toda la conversación la lleva un único prompt de sistema con 12 herramientas. El usuario pide que el chat use agentes, subagentes y skills definidos dentro del repositorio y que solo responda sobre Pokémon: lo demás se rechaza con una respuesta fija.

## What Changes

- **Alcance solo Pokémon**: el agente principal y todos los subagentes, con Claude y con OpenAI, llevan una regla de alcance en su prompt de sistema. Ante una pregunta ajena a Pokémon (juegos, especies, movimientos, habilidades, objetos, bayas, tipos, naturalezas, equipos y la propia web de la Pokédex) o un intento de saltarse las instrucciones, la respuesta es exactamente `Solo puedo responder preguntas sobre Pokémon.`, sin llamar a ninguna herramienta. Es una restricción por prompt (mejor esfuerzo), sin clasificador en el cliente.
- **Definiciones en el repositorio**: módulos ES de datos puros en `site/js/chat/agentes/`, sin framework:
  - Agente principal `profesor` (orquestador): prompt de sistema, las 12 herramientas, `delegar_subagente` y `usar_skill`.
  - Subagentes `estratega-tipos`, `entrenador-equipos` e `investigador-pokedex`, cada uno con su prompt y un subconjunto de herramientas.
  - Skills `comparar-pokemon`, `equipo-contra-tipo`, `analizar-debilidades` y `recomendar-naturaleza`, con divulgación progresiva: el prompt del `profesor` solo lista nombre y descripción de una línea; las instrucciones completas llegan al cargarlas. Las dos primeras comparten su guía con los prompts del MCP mediante un módulo nuevo de `site/js/core/`, sin cambiar el texto que devuelve el MCP.
- **Herramientas nuevas** con esquema estricto y validación en el cliente, en ambos proveedores:
  - `delegar_subagente({ subagente, tarea })`: ejecuta un bucle anidado con el mismo proveedor, modelo y clave, el prompt y las herramientas del subagente, profundidad máxima 1 y como mucho 6 iteraciones; su texto final vuelve como resultado de la herramienta y sus tokens se suman a la línea de uso.
  - `usar_skill({ nombre })`: devuelve las instrucciones de la skill.
- **Interfaz**: la línea de estado muestra `SUBAGENTE: <nombre>` mientras trabaja un subagente y `SKILL: <nombre>` al cargar una skill; `DETENER` aborta también los bucles anidados. El aviso de `chat.html` añade que delegar en subagentes consume tokens adicionales. Sin más cambios visuales.
- Tests unitarios con SSE sintético de ambos proveedores, e2e con las APIs simuladas (delegación y respuesta fuera de tema), mutación ≥ 95 % del código nuevo en una configuración propia de ≤ 180 s. Tests del MCP sin cambios.
- ADR `0007`, README, `docs/ARCHITECTURE.md`, `CHANGELOG.md` `[1.4.0]`, versión `1.4.0` y etiqueta `v1.4.0`.

Fuera de alcance: clasificador o filtro de temas en el cliente; subagentes que deleguen en otros (profundidad > 1); mostrar el texto de los subagentes en la conversación; skills o agentes definidos por el visitante; cambios en el comportamiento o los tests del servidor MCP; persistir conversaciones; pruebas con una clave real.

## Capabilities

### New Capabilities

- `chat-agentes`: agente principal, subagentes y skills del chat: alcance solo Pokémon con respuesta fija, catálogo de agentes y skills en el repositorio, herramientas `delegar_subagente` y `usar_skill`, bucle anidado (profundidad, límite, aborto, uso) e indicadores de estado.

### Modified Capabilities

- `chat-claude`: el aviso de la página menciona el coste de la delegación; el `system` es el prompt del `profesor` con la regla de alcance; el catálogo declarado pasa de 12 a 14 herramientas; la línea de tokens suma también los subagentes.
- `chat-openai`: `instructions` es el prompt del `profesor`; las funciones declaradas pasan de 12 a 14; la línea de tokens suma también los subagentes.
- `gobierno-repositorio`: ADR `0001` a `0007`.
- `documentacion-proyecto`: README con el alcance solo Pokémon, agentes, subagentes y skills, y la ADR 0007; arquitectura con `chat/agentes` en el diagrama del chat.
- `publicacion-versiones`: la verificación de la web publicada comprueba `1.4.0`.

## Impact

- **Núcleo del chat** (`site/js/chat/`): nuevos `agentes/{alcance,skills,subagentes,profesor,meta}.js`; `bucle.js` ejecuta un agente (prompt + herramientas permitidas) y despacha las dos herramientas nuevas; los adaptadores `proveedores/anthropic.js` y `proveedores/openai.js` reciben el agente en `construirPeticion` (por defecto, el `profesor`); `peticion.js` acepta `sistema` y `herramientas`.
- **Lógica compartida**: nuevo `site/js/core/guias.js` con la guía de comparar y de equipo contra un tipo; `mcp/src/prompts/*.js` la importan y siguen produciendo los mismos bytes.
- **Interfaz**: `site/js/ui/chat-view.js`, `site/js/ui/chat-main.js`, `site/js/ui/strings.js` (dos textos) y el aviso de `site/chat.html`.
- **Tests y calidad**: `site/js/purity.test.js` (nueva carpeta pura), `stryker.chat-agentes.config.json`, exclusiones en `stryker.config.json` y `stryker.chat.config.json`, script `test:mutation:chat` encadenado, `tests/e2e/chat.spec.js`.
- **Documentación y versión**: `docs/adr/0007-chat-agentes-subagentes-skills.md`, `README.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`, manifiestos y `site/js/version.js`.
- **Coste**: cada delegación hace hasta 7 peticiones más con la clave del visitante.
- **Dependencias**: ninguna nueva de runtime ni de desarrollo.
- **Coordinación**: el PR #11 (`fix/chat-openai-desplegable-y-error`) toca `proveedores/openai.js`, `sse.js`, `ui/strings.js` y CSS; este cambio evita esas líneas para rebasar sin conflictos.
