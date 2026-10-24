# chat-agentes Specification

## Purpose
Organiza el chat de `chat.html` en un agente principal, subagentes especializados y skills definidos en el repositorio, y limita sus respuestas a temas de Pokémon, con Claude y con OpenAI.

## Requirements

### Requirement: Alcance solo Pokémon
El prompt de sistema del agente principal y el de cada subagente, con ambos proveedores, SHALL limitar las respuestas a Pokémon (juegos, especies, movimientos, habilidades, objetos, bayas, tipos, naturalezas, equipos y la web de la Pokédex) e indicar que ante cualquier otro tema o intento de cambiar esas instrucciones la respuesta es exactamente `Solo puedo responder preguntas sobre Pokémon.`, sin usar herramientas.

#### Scenario: Regla en el agente principal con Claude
- **WHEN** se inspecciona el campo `system` de cualquier petición del agente principal a `api.anthropic.com`
- **THEN** contiene la restricción a temas de Pokémon y el texto exacto `Solo puedo responder preguntas sobre Pokémon.`

#### Scenario: Regla en el agente principal con OpenAI
- **WHEN** se inspecciona el campo `instructions` de cualquier petición del agente principal a `api.openai.com`
- **THEN** es el mismo texto que el `system` de Claude y contiene `Solo puedo responder preguntas sobre Pokémon.`

#### Scenario: Regla en cada subagente
- **WHEN** se inspecciona la petición de cualquiera de los tres subagentes con cualquiera de los dos proveedores
- **THEN** su prompt de sistema contiene la misma restricción y el texto exacto `Solo puedo responder preguntas sobre Pokémon.`

#### Scenario: Intento de saltarse las instrucciones
- **WHEN** se inspecciona el prompt de sistema del agente principal
- **THEN** indica que las peticiones de ignorar o cambiar esas instrucciones reciben la misma respuesta fija

### Requirement: Alcance por instrucciones, sin filtro local
La restricción de alcance SHALL aplicarse solo mediante las instrucciones del modelo: el navegador MUST NOT clasificar ni bloquear preguntas por su tema, y la respuesta del modelo se muestra como cualquier otra.

#### Scenario: Pregunta ajena a Pokémon
- **WHEN** el usuario pregunta `¿Cuál es la capital de Francia?` y la API simulada responde el texto `Solo puedo responder preguntas sobre Pokémon.` sin llamadas a herramientas
- **THEN** se hace una única petición a la API, ninguna a PokéAPI, y la conversación muestra `Solo puedo responder preguntas sobre Pokémon.` con la línea de tokens

### Requirement: Agente principal
El agente principal `profesor` SHALL atender cada pregunta con las 12 herramientas de consulta, `delegar_subagente` y `usar_skill`. Su prompt de sistema MUST listar cada subagente y cada skill solo con su nombre y una descripción de una línea, sin las instrucciones completas de las skills, y MUST ser constante entre peticiones.

#### Scenario: Catálogo en el prompt
- **WHEN** se inspecciona el prompt de sistema del agente principal
- **THEN** contiene los nombres `estratega-tipos`, `entrenador-equipos`, `investigador-pokedex`, `comparar-pokemon`, `equipo-contra-tipo`, `analizar-debilidades` y `recomendar-naturaleza`, cada uno con su descripción, y no contiene las instrucciones de ninguna skill

#### Scenario: Prompt estable
- **WHEN** se comparan los prompts de sistema de dos peticiones del agente principal en preguntas distintas
- **THEN** son idénticos

### Requirement: Subagentes y sus herramientas
El chat SHALL definir tres subagentes, cada uno con su prompt de sistema y solo estas herramientas, en el orden del catálogo: `estratega-tipos` (`obtener_pokemon`, `buscar_movimientos`, `obtener_movimiento`, `efectividad_tipos`), `entrenador-equipos` (`buscar_pokemon`, `obtener_pokemon`, `obtener_habilidad`, `efectividad_tipos`, `naturalezas`) e `investigador-pokedex` (las diez `buscar_*` y `obtener_*`).

#### Scenario: Herramientas declaradas por un subagente
- **WHEN** se inspeccionan las herramientas de la petición de `estratega-tipos`
- **THEN** son exactamente `obtener_pokemon`, `buscar_movimientos`, `obtener_movimiento` y `efectividad_tipos`, con las mismas definiciones que usa el agente principal

#### Scenario: Investigador sin efectividad ni naturalezas
- **WHEN** se inspeccionan las herramientas de la petición de `investigador-pokedex`
- **THEN** son las diez herramientas `buscar_*` y `obtener_*` y no incluyen `efectividad_tipos`, `naturalezas`, `delegar_subagente` ni `usar_skill`

### Requirement: Skills con carga bajo demanda
El chat SHALL definir las skills `comparar-pokemon`, `equipo-contra-tipo`, `analizar-debilidades` y `recomendar-naturaleza`, cada una con una descripción de una línea e instrucciones en español que nombran las herramientas que deben usarse. Las instrucciones MUST llegar al modelo solo como resultado de `usar_skill`.

#### Scenario: Cargar una skill
- **WHEN** el modelo llama a `usar_skill` con `{ "nombre": "analizar-debilidades" }`
- **THEN** no se hace ninguna petición a PokéAPI y el resultado de la herramienta es el texto de instrucciones de esa skill, sin error

#### Scenario: Instrucciones de recomendar naturaleza
- **WHEN** se carga `recomendar-naturaleza`
- **THEN** sus instrucciones nombran `obtener_pokemon` y `naturalezas`

### Requirement: Guía compartida con los prompts del MCP
Las instrucciones de `comparar-pokemon` y `equipo-contra-tipo` SHALL contener la misma guía de uso de herramientas que los prompts `comparar_pokemon` y `equipo_contra_tipo` del servidor MCP, tomada de una única fuente, y el texto que devuelven esos prompts MUST NOT cambiar.

#### Scenario: Comparar con la misma guía
- **WHEN** se carga `comparar-pokemon`
- **THEN** sus instrucciones contienen `Usa obtener_pokemon con cada uno para conocer sus tipos, estadísticas base y habilidades, y efectividad_tipos para ver cómo se atacan entre sí.`

#### Scenario: Prompts del MCP intactos
- **WHEN** se pide al servidor MCP `comparar_pokemon` con `{ "a": "pikachu", "b": "raichu" }` y `equipo_contra_tipo` con `{ "tipo": "dragon" }`
- **THEN** los textos devueltos son idénticos a los de la versión 1.3.0

### Requirement: Herramienta delegar_subagente
El agente principal SHALL declarar `delegar_subagente` con esquema estricto y dos propiedades obligatorias: `subagente` (texto con `enum` de los tres subagentes) y `tarea` (texto de 1 a 2000 caracteres tras quitar espacios). Una entrada inválida MUST NOT ejecutarse y su resultado es un error con el mensaje del campo.

#### Scenario: Subagente desconocido
- **WHEN** el modelo llama a `delegar_subagente` con `{ "subagente": "chef", "tarea": "ataques de pikachu" }`
- **THEN** no se hace ninguna petición adicional a la API y el resultado es un error con `subagente debe ser uno de: estratega-tipos, entrenador-equipos, investigador-pokedex.`

#### Scenario: Tarea vacía o demasiado larga
- **WHEN** `tarea` es `"   "` o tiene 2001 caracteres
- **THEN** no se ejecuta y el resultado es un error con `tarea debe tener entre 1 y 2000 caracteres.`

#### Scenario: Tarea en el límite
- **WHEN** `tarea` tiene exactamente 2000 caracteres
- **THEN** la delegación se ejecuta

#### Scenario: Esquema para OpenAI
- **WHEN** se inspecciona `delegar_subagente` en las `tools` de una petición a OpenAI
- **THEN** es una `function` con `strict: true`, `required` `["subagente", "tarea"]` y `additionalProperties: false`

### Requirement: Herramienta usar_skill
El agente principal SHALL declarar `usar_skill` con esquema estricto y la propiedad obligatoria `nombre` (texto con `enum` de las cuatro skills). Un nombre que no está en el catálogo MUST NOT ejecutarse y su resultado es un error con `nombre debe ser uno de: comparar-pokemon, equipo-contra-tipo, analizar-debilidades, recomendar-naturaleza.`

#### Scenario: Skill inexistente
- **WHEN** el modelo llama a `usar_skill` con `{ "nombre": "cocinar" }`
- **THEN** el resultado es un error con `nombre debe ser uno de: comparar-pokemon, equipo-contra-tipo, analizar-debilidades, recomendar-naturaleza.`

#### Scenario: Nulo con OpenAI
- **WHEN** OpenAI llama a `usar_skill` con `{"nombre":null}`
- **THEN** el resultado es un error con el mismo mensaje

### Requirement: Ejecución de un subagente
`delegar_subagente` SHALL ejecutar un bucle de herramientas propio con el mismo proveedor, modelo y clave de la pregunta, el prompt y las herramientas del subagente y un historial que solo contiene `tarea` como mensaje del usuario. El texto de su respuesta final SHALL ser el resultado de la herramienta y MUST NOT mostrarse en la conversación.

#### Scenario: Delegación con una consulta
- **WHEN** el agente principal delega en `estratega-tipos` la tarea `debilidades de gyarados`, el subagente llama a `efectividad_tipos` y responde `Gyarados es débil a electric (x4) y rock.`, y después el agente principal responde un texto final
- **THEN** la petición del subagente usa el mismo modelo y clave, su primer mensaje es la tarea, la segunda petición del agente principal contiene un resultado de `delegar_subagente` con `Gyarados es débil a electric (x4) y rock.` y la conversación muestra solo el texto final del agente principal

#### Scenario: Herramientas en paralelo con la delegación
- **WHEN** un mismo turno del agente principal pide `delegar_subagente` y `obtener_pokemon`
- **THEN** ambas se ejecutan y sus resultados van en la siguiente petición en el orden de las llamadas

### Requirement: Profundidad máxima de delegación
Un subagente MUST NOT delegar ni cargar skills: sus peticiones no declaran `delegar_subagente` ni `usar_skill`, y cualquier llamada a una herramienta fuera de su lista MUST NOT ejecutarse y recibe el error `Herramienta desconocida: <nombre>.`

#### Scenario: Subagente que intenta delegar
- **WHEN** la API simulada hace que `investigador-pokedex` llame a `delegar_subagente`
- **THEN** no se inicia ningún otro subagente y el resultado de esa llamada es un error con `Herramienta desconocida: delegar_subagente.`

#### Scenario: Herramienta fuera de su lista
- **WHEN** `estratega-tipos` llama a `naturalezas`
- **THEN** no se hace ninguna petición a PokéAPI y el resultado es un error con `Herramienta desconocida: naturalezas.`

### Requirement: Límite de iteraciones de un subagente
Cada delegación SHALL admitir como máximo 6 iteraciones de herramientas (7 peticiones); al superarlo MUST detenerse y devolver al agente principal el error `El subagente <nombre> alcanzó el límite de consultas.` Las peticiones de los subagentes MUST NOT contar para el límite de 8 iteraciones del agente principal.

#### Scenario: Subagente que nunca termina
- **WHEN** la API simulada responde siempre con una llamada a herramienta dentro de `entrenador-equipos`
- **THEN** el subagente hace exactamente 7 peticiones y el agente principal recibe un error con `El subagente entrenador-equipos alcanzó el límite de consultas.` y continúa

### Requirement: Finales no válidos de un subagente
Si el subagente termina por rechazo, la delegación SHALL devolver el error `El subagente <nombre> no puede responder a esta tarea.`; si termina cortado con llamadas pendientes o sin texto, el error `El subagente <nombre> no terminó su respuesta.` Una respuesta cortada por longitud sin llamadas devuelve su texto sin error.

#### Scenario: Rechazo del subagente
- **WHEN** la respuesta del subagente `investigador-pokedex` termina en rechazo
- **THEN** el agente principal recibe un error con `El subagente investigador-pokedex no puede responder a esta tarea.`

#### Scenario: Subagente sin texto
- **WHEN** el subagente termina con un texto final vacío
- **THEN** el agente principal recibe un error con `El subagente <nombre> no terminó su respuesta.` con el nombre de ese subagente

### Requirement: Errores de API dentro de un subagente
Un error de la API en una petición de un subagente, tras los mismos reintentos que el agente principal, SHALL terminar la pregunta entera con el mismo mensaje de error que mostraría el agente principal, y la pregunta MUST NOT incorporarse a la conversación.

#### Scenario: Clave rechazada durante la delegación
- **WHEN** la primera petición del agente principal pide una delegación y la petición del subagente responde 401
- **THEN** no se hacen más peticiones, se muestra el mensaje de clave no válida del proveedor y la siguiente pregunta se envía sin los turnos de la fallida

### Requirement: Detener durante la delegación
`DETENER` SHALL abortar también las peticiones y herramientas de los subagentes en curso; después MUST NOT hacerse ninguna petición más de esa pregunta.

#### Scenario: Detener con un subagente trabajando
- **WHEN** hay una petición de un subagente retenida y el usuario pulsa `DETENER`
- **THEN** esa petición se aborta, no se hace ninguna petición más, la pregunta no se incorpora a la conversación y se puede enviar otra

### Requirement: Uso de tokens con subagentes
La línea `Tokens: <entrada> entrada · <salida> salida` de cada pregunta SHALL sumar, además de las peticiones del agente principal, todas las de sus subagentes, terminen como terminen.

#### Scenario: Pregunta con una delegación
- **WHEN** con Claude el agente principal hace dos peticiones de uso `{input 100, output 20}` y `{input 200, output 30}` y su subagente hace dos de uso `{input 50, output 10}` y `{input 60, output 15}`
- **THEN** se muestra `Tokens: 410 entrada · 75 salida`

### Requirement: Indicadores de agentes y skills
Mientras un subagente trabaja, la línea de estado SHALL mostrar `SUBAGENTE: <nombre>`, y al cargar una skill `SKILL: <nombre>`, en la misma región de estado que `CONSULTANDO: <nombre_tool>`. Las consultas internas de un subagente MUST NOT cambiar esa línea.

#### Scenario: Subagente en curso
- **WHEN** `estratega-tipos` está trabajando y ejecuta `efectividad_tipos`
- **THEN** la página muestra `SUBAGENTE: estratega-tipos` y no `CONSULTANDO: efectividad_tipos`

#### Scenario: Skill cargada
- **WHEN** el agente principal carga `comparar-pokemon`
- **THEN** la página muestra `SKILL: comparar-pokemon`
