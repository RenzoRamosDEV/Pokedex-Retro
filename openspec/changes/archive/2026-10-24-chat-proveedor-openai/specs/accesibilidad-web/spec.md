## MODIFIED Requirements

### Requirement: Estructura accesible del chat
`chat.html` SHALL cumplir lo común a las páginas de sección (salto al contenido, `<main id="contenido" tabindex="-1">`, una única región `role="status"` con `aria-live="polite"` dentro de `<main>` y aviso `<noscript>`), y su zona de mensajes MUST tener `role="log"` y `aria-live="polite"`. Todo campo de sus formularios, incluido el selector de proveedor, SHALL tener una etiqueta asociada.

#### Scenario: Zona de mensajes
- **WHEN** se inspecciona el HTML de `chat.html`
- **THEN** la zona de mensajes tiene `role="log"` y `aria-live="polite"`, y hay exactamente una región `role="status"` dentro de `<main>`

#### Scenario: Campos etiquetados
- **WHEN** se inspeccionan el selector de proveedor, el campo de clave, la casilla `Recordar en este navegador`, los selectores de modelo y el campo de mensaje
- **THEN** cada uno tiene un `<label>` asociado con texto no vacío

### Requirement: Chat sin violaciones de axe
`chat.html` MUST NOT tener violaciones axe de impacto `serious` ni `critical` en los temas `normal`, `gb` y `gray`, con el formulario de clave visible y con una conversación que incluye una respuesta y un error, con cada uno de los dos proveedores.

#### Scenario: Auditoría del chat por tema
- **WHEN** se audita con axe `chat.html` en cada tema, antes y después de una conversación simulada
- **THEN** no hay ninguna violación de impacto `serious` ni `critical`

#### Scenario: Auditoría con OpenAI
- **WHEN** se audita con axe `chat.html` en cada tema con el proveedor `OpenAI`, con su formulario de clave y tras una conversación simulada con respuesta y error
- **THEN** no hay ninguna violación de impacto `serious` ni `critical`
