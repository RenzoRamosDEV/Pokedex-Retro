# Spec Delta

## MODIFIED Requirements

### Requirement: Política de seguridad de contenidos
Cada página HTML de `site/` SHALL incluir en su `<head>`, antes de cualquier hoja de estilos o script, `<meta http-equiv="Content-Security-Policy">` con el contenido exacto `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' https://raw.githubusercontent.com; connect-src https://pokeapi.co https://api.anthropic.com; manifest-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`. La política MUST NOT contener `'unsafe-inline'` ni `'unsafe-eval'`.

#### Scenario: Política presente en todas las páginas
- **WHEN** se inspecciona el `<head>` de cada HTML de `site/`, incluida la página 404
- **THEN** contiene exactamente una meta `Content-Security-Policy` con el contenido indicado

#### Scenario: Orígenes de conexión exactos
- **WHEN** se lee la directiva `connect-src` de cualquier página
- **THEN** contiene exactamente `https://pokeapi.co https://api.anthropic.com`, en ese orden y sin más orígenes

#### Scenario: Navegación real sin violaciones
- **WHEN** se carga `index.html?q=char` en un navegador contra PokéAPI real y se abre una ficha
- **THEN** la consola no muestra ninguna violación de la política de seguridad de contenidos

#### Scenario: Chat real sin violaciones
- **WHEN** se carga `chat.html` en un navegador y se envía una pregunta a la API real de Claude con una clave inválida
- **THEN** la consola no muestra ninguna violación de la política de seguridad de contenidos
