# Pokédex Retro

Pokédex retro estática sobre [PokéAPI v2](https://pokeapi.co/), sin backend. Está hecha con HTML, CSS y JavaScript puro (módulos ES), sin frameworks ni paso de compilación, y tiene la estética de las consolas clásicas: Game Boy DMG-01 y los juegos de primera generación.

Los datos se piden directamente desde el navegador a `https://pokeapi.co/api/v2`, así que el sitio puede publicarse tal cual en GitHub Pages.

## Secciones

| Página | Contenido |
| --- | --- |
| `index.html` | Pokédex: rejilla de Pokémon con sprite, tipos y ficha detallada |
| `movimientos.html` | Movimientos con potencia, precisión, PP y efecto |
| `tipos.html` | Tabla de efectividad de tipos |
| `habilidades.html` | Habilidades y su efecto |
| `naturalezas.html` | Naturalezas agrupadas por estadística afectada |
| `objetos.html` | Objetos con categoría, precio y efecto |
| `bayas.html` | Bayas con crecimiento, firmeza y sabores |

Todas las secciones tienen buscador por nombre y, salvo Tipos y Naturalezas, paginación. La búsqueda y la página van en la URL (`?q=char&page=2`).

## Temas

Desde el botón de tema se elige entre **NORMAL** (rojo clásico), **DMG** (verde LCD de la Game Boy) y **MONO** (escala de grises). La elección se guarda en `localStorage`.

## Uso en local

```bash
python3 -m http.server -d site
```

Abre `http://localhost:8000/`. Cualquier servidor estático sirve; abrir los HTML con `file://` no funciona porque los módulos ES necesitan HTTP.

## Tests

Requiere Node ≥ 22. Los tests usan el runner nativo de Node y respuestas de PokéAPI simuladas, así que no necesitan red ni dependencias:

```bash
npm test
```

Tests de mutación con Stryker sobre `site/js/core` y `site/js/mappers`:

```bash
npm install
npm run test:mutation
```

## Estructura

```
site/
├── *.html              siete páginas
├── css/pokedex.css     estilos y temas
├── images/             logotipo
└── js/
    ├── core/           lógica pura: URL, búsqueda, paginación, carga de secciones
    ├── mappers/        PokéAPI → datos de vista (con fixtures de respuestas reales)
    └── ui/             renderizado en el DOM y selector de tema
```

## Despliegue en GitHub Pages

El workflow `.github/workflows/pages.yml` ejecuta `npm test` y, si pasa, publica la carpeta `site/` en cada push a `main` (también se puede lanzar a mano).

Para activarlo una sola vez: **Settings → Pages → Build and deployment → Source: GitHub Actions**. El sitio queda en:

https://renzoramosdev.github.io/Pokedex-Retro/
