# Diseño: agentes, subagentes y skills en el chat, solo sobre Pokémon

## Context

Motivación y alcance: proposal.md. Requisitos: `specs/chat-agentes` y deltas. Decisiones previas: `openspec/changes/archive/2026-10-24-chat-byok-claude/design.md` (D1–D13), `openspec/changes/archive/2026-10-24-chat-proveedor-openai/design.md` (D1–D10), ADR 0005 y 0006.

Estado actual relevante (`main`, 1.3.0):

- `bucle.js` `responder({ mensajes, pregunta, modelo, clave, fetch, port, signal, esperar, alEvento, ahora, proveedor })`: bucle único con `MAX_ITERACIONES = 8`; `ejecutarLlamadas(llamadas, port, alEvento)` emite `{ tipo: 'herramienta' }` y llama a `ejecutarHerramienta(port, nombre, entrada)`, que solo conoce las 12 tools de `herramientas.js` (`DEFINICIONES`, `POR_NOMBRE`).
- El prompt y el catálogo están fijos en dos sitios: `peticion.js` (`SISTEMA`, `tools: DEFINICIONES`) para Anthropic y `proveedores/openai.js` (`instructions: SISTEMA`, `tools: FUNCIONES`, derivado de `DEFINICIONES` con `parametrosEstrictos`). Ambos adaptadores exponen `construirPeticion({ modelo, clave, historial })`.
- `openai.js` `entradaDe` ya quita propiedades `null` de primer nivel antes de validar; cualquier tool nueva lo hereda.
- MCP: `mcp/src/prompts/{comparar-pokemon,equipo-contra-tipo}.js` construyen su texto en línea; `mcp/test/prompts.test.js` fija esos textos byte a byte. La dirección de dependencias permitida es `mcp → site/js/core`.
- `site/js/purity.test.js` recorre una lista fija `PURE_DIRS = ['core', 'mappers', 'chat', 'chat/proveedores']`.
- Mutación: `stryker.config.json` muta `site/js/core/**` salvo tres módulos del chat; `test:mutation:chat` encadena `chat-core`, `chat-openai` y `chat`; la de `chat` ya tarda 151 s en CI.
- `chat-view.js` `showTool(name)` pinta `STRINGS.chat.consultando` en la región `role="status"`; `chat-main.js` `onEvent` trata todo lo que no es `texto` ni `herramienta` como `uso`.
- PR #11 (`fix/chat-openai-desplegable-y-error`, pendiente de merge) toca en `openai.js` `admiteNull`/`parametrosEstrictos`, `errorDeStream` y `case 'error'`; en `sse.js` `parsearEvento`; en `strings.js` `chatOpenai.errorServidor`; y CSS. Cambia `parametrosEstrictos` para añadir `null` a los `enum` de propiedades opcionales.

## Goals / Non-Goals

**Goals:**
- Agentes y skills como datos puros versionados; el bucle ejecuta «un agente» (prompt + herramientas permitidas + límite) sin conocer cuál.
- Una única fuente de verdad para los prompts de sistema de ambos proveedores.
- Delegación con el mismo puerto de proveedor, reintentos, aborto y suma de uso que la pregunta principal.
- Rebase limpio sobre PR #11.

**Non-Goals:**
- Registro dinámico de agentes, agentes cargados desde Markdown o red, configuración por el visitante.
- Streaming del texto del subagente a la interfaz, historial persistente del subagente entre delegaciones.
- Límite de delegaciones paralelas por turno (ver Riesgos).
- Cambiar la semántica de `CONSULTANDO`, del compromiso de turnos ni de los errores existentes.

## Decisions

### D1. Módulos de `site/js/chat/agentes/`

Datos y funciones puras, `// @ts-check`, sin DOM, añadidos a `PURE_DIRS`:

| Módulo | Contenido |
| --- | --- |
| `alcance.js` | `RESPUESTA_FUERA_DE_TEMA = 'Solo puedo responder preguntas sobre Pokémon.'`; `BASE` (texto actual de `peticion.js` `SISTEMA`: Pokédex, usar siempre herramientas, nombres en inglés, español y texto plano); `REGLA_ALCANCE` (temas permitidos de la spec; otro tema o petición de ignorar, revelar o cambiar las instrucciones → responder exactamente `RESPUESTA_FUERA_DE_TEMA` y nada más, sin herramientas). |
| `skills.js` | `SKILLS`: `{ nombre, descripcion, instrucciones }[]` en el orden de la spec. |
| `subagentes.js` | `SUBAGENTES`: `{ nombre, descripcion, sistema, herramientas, maxIteraciones: 6 }[]`; `herramientas` = `DEFINICIONES` filtradas por nombre (orden del catálogo); `sistema` = rol + `REGLA_ALCANCE` + `BASE`. |
| `meta.js` | Definiciones de `delegar_subagente` y `usar_skill` (mismo formato que `DEFINICIONES`); `validarDelegacion(entrada)`; `cargarSkill(entrada)` → `{ contenido, esError }`; `resultadoSubagente(nombre, final)` → `{ contenido, esError }`; textos de error de la spec. |
| `profesor.js` | `PROFESOR = { nombre: 'profesor', sistema, herramientas: [...DEFINICIONES, ...META], maxIteraciones: 8 }`; `sistema` = `BASE` + `REGLA_ALCANCE` + lista `- <nombre>: <descripcion>` de subagentes (usar `delegar_subagente` solo si la tarea necesita varias consultas de su especialidad) y de skills (cargar con `usar_skill` antes de seguirlas). |

Tipo común `Agente = { nombre, sistema, herramientas, maxIteraciones }`. Los textos son constantes (sin fecha ni datos variables) para que la caché de prompt funcione por agente.

Grafo de imports (sin ciclos): `alcance` ← `skills`, `subagentes` ← `profesor`; `herramientas` ← `subagentes`, `meta`, `profesor`; `core/guias` ← `skills`; `profesor` ← `proveedores/*`, `bucle`.

Alternativas: ficheros Markdown con frontmatter leídos por `fetch` (añade E/S, parseo y fallos de red a algo estático; sin bundler no se pueden importar); clases `Agente` con comportamiento (no hay comportamiento por agente, solo datos).

### D2. Única fuente del prompt de sistema

`peticion.js` deja de definir `SISTEMA`: `construirPeticion({ modelo, clave, mensajes, sistema, herramientas })` recibe ambos. Los adaptadores pasan a `construirPeticion({ modelo, clave, historial, agente = PROFESOR })`:

- Anthropic: `sistema: agente.sistema`, `herramientas: agente.herramientas`; orden de claves del cuerpo sin cambios.
- OpenAI: `instructions: agente.sistema`, `tools: agente.herramientas.map(comoFuncion)`. `comoFuncion` (exportada) es el cuerpo actual del `map` de `FUNCIONES` y sigue usando `parametrosEstrictos`; `FUNCIONES` se conserva como `DEFINICIONES.map(comoFuncion)` (las 12 de consulta, que `openai.test.js` ya usa como referencia). Orden de claves sin cambios.

El valor por defecto mantiene válidas las llamadas actuales de `anthropic.test.js`, `openai.test.js` y `bucle.test.js`; sus aserciones sobre `system`/`instructions` pasan a comparar con `PROFESOR.sistema` y las de `tools` con las 14 del agente principal. Las comprobaciones de contenido de `SISTEMA` en `peticion.test.js` se trasladan a `agentes/profesor.test.js`. `delegar_subagente` y `usar_skill` solo tienen propiedades obligatorias, así que `parametrosEstrictos` (antes o después de PR #11) las deja intactas.

Alternativa: mantener `SISTEMA` en `peticion.js` y concatenar la regla en cada adaptador; descartada porque son dos fuentes y los subagentes necesitan prompts propios igualmente.

### D3. Bucle por agente

`bucle.js` extrae el cuerpo del `for` actual a `ejecutarAgente({ agente, historial, ctx, alTexto })` → `{ estado: 'fin' | 'cortada' | 'rechazo' | 'limite', historial, uso, texto }`, que lanza los errores (clasificados o `AbortError`) en vez de capturarlos. `ctx = { modelo, clave, fetch, port, signal, esperar, ahora, proveedor, alEvento }`. `texto` = deltas visibles de la última petición (se reinicia en cada iteración). El límite es `agente.maxIteraciones` (8 → 9 peticiones; 6 → 7).

`responder` conserva su firma y su contrato: construye la conversación, llama a `ejecutarAgente(PROFESOR, …)` con `alTexto` → `alEvento({ tipo: 'texto' })`, y mantiene `terminar`, el compromiso de turnos, el `catch` (`abortada`/`error`) y el evento `uso` exactamente como hoy. Así `bucle.test.js` sigue siendo la red de seguridad.

`ejecutarLlamadas(llamadas, agente, ctx)` despacha cada llamada, en paralelo y en orden de resultado:

1. Nombre fuera de `agente.herramientas` → `{ contenido: 'Herramienta desconocida: <nombre>.', esError: true }` (mismo texto que `ejecutarHerramienta`). Esto impone la profundidad 1 y el subconjunto de cada subagente aunque el modelo invente llamadas.
2. `ENTRADA_NO_JSON` → `TEXTO_NO_JSON` como hoy.
3. `usar_skill` → `alEvento({ tipo: 'skill', nombre })` tras validar, `cargarSkill`.
4. `delegar_subagente` → `validarDelegacion`; si es válida, `alEvento({ tipo: 'subagente', nombre })`, `ejecutarAgente(subagente, [proveedor.mensajeUsuario(tarea)], { ...ctx, alEvento: soloUso }, acumular)` y `resultadoSubagente(nombre, final)`; devuelve además `uso` del subagente.
5. Resto → `alEvento({ tipo: 'herramienta' })` y `ejecutarHerramienta` como hoy.

`responder` suma al `uso` de la pregunta el de cada salida que lo traiga. El `alEvento` del subagente descarta `texto`, `herramienta`, `skill` y `subagente`, de modo que la línea de estado sigue en `SUBAGENTE: <nombre>` y el texto del subagente no llega a la conversación.

`resultadoSubagente`: `fin` o `cortada` sin llamadas con `texto.trim()` no vacío → `{ contenido: texto, esError: false }`; `rechazo` → `no puede responder a esta tarea.`; `limite` → `alcanzó el límite de consultas.`; resto (cortada con llamadas, texto vacío) → `no terminó su respuesta.`

Alternativas: un `bucle-subagente.js` separado (duplica reintentos, lectura, límite y aborto); delegación como herramienta de `herramientas.js` (necesitaría proveedor, clave, `fetch` y `signal` dentro de la capa de tools, que hoy solo recibe el puerto de PokéAPI).

### D4. Esquemas y validación de las herramientas nuevas

`input_schema` con `type`, `enum`, `required`, `additionalProperties: false` y `description` (compatibles con `strict` en ambos proveedores, D4 de 1.2.0 y D4 de 1.3.0); los límites van en la descripción. `strict: true` y `eager_input_streaming: true` como las demás.

- `delegar_subagente`: `subagente` (`enum` de `SUBAGENTES`), `tarea` (texto, «de 1 a 2000 caracteres»). Validación: `subagente` texto incluido en el `enum` tras `trim`, si no `subagente debe ser uno de: …`; `tarea` texto con longitud tras `trim` entre 1 y 2000, si no `tarea debe tener entre 1 y 2000 caracteres.`; propiedades desconocidas ignoradas; ausente o no texto → el mensaje del campo.
- `usar_skill`: `nombre` (`enum` de `SKILLS`), mismo criterio, `nombre debe ser uno de: …`.

Las listas de los mensajes se generan desde `SUBAGENTES`/`SKILLS` para que no diverjan.

### D5. Guía compartida con el MCP

Nuevo `site/js/core/guias.js` (puro) con `GUIA_COMPARAR` (`Usa obtener_pokemon con cada uno … nombre exacto.`) y `GUIA_EQUIPO` (`Usa efectividad_tipos … (p. ej. fire).`), copiados byte a byte de los prompts actuales. Los prompts del MCP pasan a `` `Compara los Pokémon "${a}" y "${b}". ${GUIA_COMPARAR}` `` y `` `Propón un equipo de 6 Pokémon para enfrentarse a rivales de tipo "${tipo}". ${GUIA_EQUIPO}` ``; las skills `comparar-pokemon` y `equipo-contra-tipo` anteponen una frase propia («Compara los dos Pokémon que indique el usuario.» / «Propón un equipo de 6 Pokémon contra el tipo que indique el usuario.») a la misma guía. Verificación: `npm run mcp:test` en verde y `git diff main -- mcp/test` vacío.

Alternativa: importar `mcp/src/prompts` desde la web (arrastra zod y el SDK al navegador e invierte la dependencia).

### D6. Interfaz

- `STRINGS.chat` añade `subagente: 'SUBAGENTE: {nombre}'` y `skill: 'SKILL: {nombre}'` justo después de `consultando` (lejos de `chatOpenai.errorServidor`, que toca PR #11).
- `chat-view.js`: `showSubagent(nombre)` y `showSkill(nombre)` con el mismo `showStatus`.
- `chat-main.js` `onEvent`: ramas explícitas `subagente` y `skill`; `uso` deja de ser la rama por defecto.
- `chat.html`: el aviso añade `Delegar en subagentes consume tokens adicionales.`; `pages-a11y.test.js` actualiza el texto exacto.
- `DETENER`: sin cambios en la interfaz; el mismo `AbortController.signal` llega a los bucles anidados por `ctx`.

### D7. Errores, aborto y uso en la delegación

- Un error de API del subagente (tras los mismos reintentos de `enviar`) se propaga sin capturar: `Promise.all` rechaza, `responder` lo clasifica y termina en `error` sin incorporar la pregunta. Misma clave y proveedor: no hay error «del subagente» que el agente principal pueda resolver, y seguir solo gastaría tokens.
- `AbortError` se propaga igual → `abortada`. Las llamadas hermanas comparten `signal` y también abortan.
- El `uso` del subagente se suma termine como termine; la línea solo se muestra en `fin`/`cortada`, como hoy.

### D8. Tests

- `tests/support/claude-sse.js` y `openai-sse.js` se reutilizan; si hace falta, un `fetch` falso que devuelve respuestas en cola y registra los cuerpos (para distinguir peticiones de subagente por `system`/`instructions`).
- `agentes/*.test.js`: catálogos exactos (nombres, orden, subconjuntos, descripciones de una línea), prompts (regla y texto fijo en profesor y en los tres subagentes; profesor sin `instrucciones` de ninguna skill; constancia), validación con particiones y límites (`tarea` 0, 1, 2000, 2001 tras `trim`; no texto; ausente; `enum` con mayúsculas y espacios), `cargarSkill`, `resultadoSubagente` por estado.
- `core/guias.test.js`: igualdad exacta con los textos del MCP de 1.3.0 (golden).
- `bucle.test.js` (casos nuevos, ambos proveedores): delegación de extremo a extremo; profundidad (subagente que llama a `delegar_subagente` o a una tool fuera de su lista); límite del subagente (7 peticiones) sin afectar al límite principal; rechazo, cortada, vacío; error 401 del subagente; aborto con petición de subagente retenida; suma de uso; eventos `subagente`/`skill` y ausencia de `herramienta` del subagente; `delegar_subagente` + `obtener_pokemon` en paralelo con orden de resultados.
- `proveedores/{anthropic,openai}.test.js`: 14 tools en el agente principal, `system`/`instructions` = `PROFESOR.sistema`, petición con un subagente usa su prompt y su subconjunto.
- `chat-view.test.js`/`strings.test.js`: textos nuevos (casos añadidos al final del fichero para no chocar con PR #11).
- e2e (`tests/e2e/chat.spec.js`, mocks existentes): con Claude, delegación con la petición del subagente retenida (se ve `SUBAGENTE: estratega-tipos`; se suelta; texto final y tokens sumados); pregunta fuera de tema con Claude y con OpenAI (una sola petición, ninguna a PokéAPI, se muestra la respuesta fija y el `system`/`instructions` enviado contiene la regla); aviso nuevo.

### D9. Mutación

- `stryker.chat-agentes.config.json`: `mutate` = `site/js/chat/agentes/**/*.js`, `site/js/chat/bucle.js`, `site/js/core/guias.js` (sin tests); comando `node --test --experimental-test-isolation=none` sobre `site/js/chat/agentes/*.test.js`, `site/js/chat/bucle.test.js` y `site/js/core/guias.test.js`; `break: 95`.
- `stryker.chat.config.json` excluye `bucle.js` y `agentes/**` (resta mutantes a la ejecución de 151 s); `stryker.config.json` excluye `core/guias.js`.
- Script `test:mutation:chat:agentes` (`timeout 180 …`) encadenado en `test:mutation:chat`. Cada ejecución medida con `time`; si `chat-agentes` supera 180 s, `bucle.js` pasa a `stryker.chat-bucle.config.json` con el mismo umbral. Ningún `break` se baja; los supervivientes se justifican en el PR.

### D10. Coordinación con PR #11

- Si PR #11 ya está en `main` al empezar la implementación, la primera tarea rebasa la rama (que solo contiene `openspec/`) sobre `origin/main`.
- Si no, el código evita las líneas que toca PR #11: en `openai.js` solo cambian el import de `SISTEMA` (pasa a `PROFESOR`), la extracción de `comoFuncion` sobre `FUNCIONES`, la firma de `construirPeticion` y sus líneas `instructions`/`tools`; en `strings.js` solo el grupo `chat`; `sse.js` y CSS no se tocan. Los tests nuevos no dependen de cómo `parametrosEstrictos` trate los `enum` opcionales.

### D11. Documentación y versión

ADR `0007-chat-agentes-subagentes-skills.md` (Contexto, Decisión, Consecuencias, Alternativas: clasificador en el cliente, SDK de agentes, Markdown en tiempo de ejecución, delegación anidada). README (sección del chat), `docs/ARCHITECTURE.md` (`chat/agentes` en el tercer diagrama y en carpetas), `CONTRIBUTING.md` (cuarta configuración de mutación del chat), `CHANGELOG.md` `[1.4.0]`. Versión con `npm version 1.4.0 --no-git-tag-version` en raíz y `mcp/` y `mcp/server.json`, como en 1.3.0.

## Risks / Trade-offs

- [El alcance depende del modelo: un prompt hábil puede sacarlo de tema] → regla explícita también contra peticiones de ignorar instrucciones, en todos los agentes; documentado como mejor esfuerzo en ADR 0007 y README. Un clasificador local daría falsos positivos con nombres de Pokémon y no es más fiable.
- [Coste: cada delegación hace hasta 7 peticiones y el modelo puede pedir varias en paralelo] → límite por subagente, profundidad 1, descripción de `delegar_subagente` que pide usarla solo cuando haga falta, aviso visible en `chat.html` y uso sumado en la línea de tokens. Si el coste real resulta excesivo, limitar delegaciones por pregunta es un cambio posterior con su propia spec.
- [Falsos rechazos de preguntas legítimas en el límite del tema (p. ej. la web)] → la regla enumera la web de la Pokédex y los equipos como temas válidos.
- [Más latencia percibida mientras trabaja un subagente sin texto en pantalla] → línea `SUBAGENTE: <nombre>` y `DETENER` operativo.
- [Caché de prompt fragmentada por agente] → cada prompt es constante; el agente principal conserva su prefijo estable.
- [Conflictos con PR #11] → D10.
- [Mutación de `chat` cerca de 180 s] → `bucle.js` y `agentes/` salen a su propia configuración (D9) y se mide cada una.
- [Cambio accidental de los prompts del MCP] → `mcp/test/prompts.test.js` intacto como golden y `git diff main -- mcp/test` vacío.

## Migration Plan

Sin migración de datos ni de almacenamiento: las claves siguen bajo las mismas entradas y la conversación sigue solo en memoria. Despliegue por Pages tras el merge. Vuelta atrás: revertir el merge; no queda estado huérfano.
