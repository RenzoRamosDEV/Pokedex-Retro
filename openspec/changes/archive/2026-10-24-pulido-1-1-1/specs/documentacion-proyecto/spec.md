# Spec Delta

## MODIFIED Requirements

### Requirement: Demo animada reproducible
`docs/media/demo.gif` SHALL ocupar como máximo 3 000 000 bytes y durar como máximo 15 s, y SHALL generarse con `node scripts/capture-demo.mjs` sobre `site/` servido localmente con PokéAPI simulada, sin peticiones externas. El script MUST NOT formar parte de CI. La PokéAPI simulada SHALL dar a `#25 pikachu` su tipo real `electric`, de modo que la demo no muestre datos contradictorios.

#### Scenario: Límites del GIF
- **WHEN** se inspecciona `docs/media/demo.gif`
- **THEN** pesa 3 000 000 bytes o menos y su duración es de 15 s o menos

#### Scenario: GIF fuera de límites
- **WHEN** la captura produce un GIF de más de 3 000 000 bytes o de más de 15 s
- **THEN** el script termina con código distinto de 0 indicando el límite superado y el valor medido

#### Scenario: Sin red externa
- **WHEN** se ejecuta el script sin acceso a internet
- **THEN** genera el GIF y termina con código 0

#### Scenario: Fuera de CI
- **WHEN** se revisan los workflows de `.github/workflows/`
- **THEN** ninguno ejecuta `scripts/capture-demo.mjs`

#### Scenario: PIKACHU eléctrico
- **WHEN** la demo o el e2e abren el diálogo de `#25 pikachu`
- **THEN** muestra el tipo `ELECTRIC` y no el tipo del fixture genérico
