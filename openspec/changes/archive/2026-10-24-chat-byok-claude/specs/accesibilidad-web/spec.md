# Spec Delta

## ADDED Requirements

### Requirement: Estructura accesible del chat
`chat.html` SHALL cumplir lo común a las páginas de sección (salto al contenido, `<main id="contenido" tabindex="-1">`, una única región `role="status"` con `aria-live="polite"` dentro de `<main>` y aviso `<noscript>`), y su zona de mensajes MUST tener `role="log"` y `aria-live="polite"`. Todo campo de sus formularios SHALL tener una etiqueta asociada.

#### Scenario: Zona de mensajes
- **WHEN** se inspecciona el HTML de `chat.html`
- **THEN** la zona de mensajes tiene `role="log"` y `aria-live="polite"`, y hay exactamente una región `role="status"` dentro de `<main>`

#### Scenario: Campos etiquetados
- **WHEN** se inspeccionan el campo de clave, la casilla `Recordar en este navegador`, el selector de modelo y el campo de mensaje
- **THEN** cada uno tiene un `<label>` asociado con texto no vacío

### Requirement: Foco en el chat
Tras guardar una clave válida y tras terminar cada respuesta, por cualquier motivo, el foco SHALL pasar al campo de mensaje.

#### Scenario: Foco tras la clave
- **WHEN** el usuario guarda una clave válida con el teclado
- **THEN** el foco está en el campo de mensaje

#### Scenario: Foco tras una respuesta
- **WHEN** termina una respuesta, con éxito o con error
- **THEN** el foco está en el campo de mensaje

### Requirement: Chat sin violaciones de axe
`chat.html` MUST NOT tener violaciones axe de impacto `serious` ni `critical` en los temas `normal`, `gb` y `gray`, con el formulario de clave visible y con una conversación que incluye una respuesta y un error.

#### Scenario: Auditoría del chat por tema
- **WHEN** se audita con axe `chat.html` en cada tema, antes y después de una conversación simulada
- **THEN** no hay ninguna violación de impacto `serious` ni `critical`
