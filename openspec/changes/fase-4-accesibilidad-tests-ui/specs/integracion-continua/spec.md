# Spec Delta

## MODIFIED Requirements

### Requirement: Mutación solo en Node 24
El workflow `CI` SHALL ejecutar `npm run test:mutation` y `npm run test:mutation:ui` únicamente en la combinación de Node 24, con el mismo límite de 180 s por ejecución que en local.

#### Scenario: Matriz de Node 22
- **WHEN** el workflow `CI` corre en Node 22
- **THEN** los pasos de mutación se omiten

#### Scenario: Matriz de Node 24
- **WHEN** el workflow `CI` corre en Node 24
- **THEN** se ejecutan `npm run test:mutation` y `npm run test:mutation:ui` y el fallo de cualquiera marca el workflow como fallido

## ADDED Requirements

### Requirement: e2e en Node 24
El workflow `CI` SHALL instalar solo Chromium con sus dependencias del sistema y ejecutar `npm run e2e` únicamente en la combinación de Node 24, en cada `pull_request` y `push` a `main`; su fallo MUST marcar el workflow como fallido.

#### Scenario: e2e en un PR
- **WHEN** el workflow `CI` de un PR corre en Node 24
- **THEN** se ejecuta `npm run e2e` y su fallo marca el workflow como fallido

#### Scenario: e2e omitido en Node 22
- **WHEN** el workflow `CI` corre en Node 22
- **THEN** no se instalan navegadores ni se ejecuta `npm run e2e`

### Requirement: Lighthouse CI en pull requests
El workflow `CI` SHALL ejecutar `npm run lhci` solo en eventos `pull_request` y solo en la combinación de Node 24, sin secretos ni subida de informes a servicios externos; su fallo MUST marcar el workflow como fallido.

#### Scenario: Lighthouse en un PR
- **WHEN** el workflow `CI` corre por un `pull_request` en Node 24
- **THEN** se ejecuta `npm run lhci`

#### Scenario: Push a main sin Lighthouse
- **WHEN** el workflow `CI` corre por un `push` a `main`
- **THEN** no se ejecuta `npm run lhci`
