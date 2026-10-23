import { parseQuery } from '../core/query.js';
import { SECTIONS } from '../core/sections.js';
import { loadSection } from '../core/load-section.js';
import { applyStatBarWidths, pageHeader, sectionBody, statusText } from './layout.js';
import { pokedexView } from './render-pokedex.js';
import { movesView } from './render-moves.js';
import { naturesView } from './render-natures.js';
import { itemsView } from './render-items.js';
import { berriesView } from './render-berries.js';
import { typesView } from './render-types.js';
import { abilitiesView } from './render-abilities.js';
import { createFetchJson } from '../api/client.js';
import { createApiCache } from '../api/cache.js';
import { loadUntilPageHide } from './cancelable-load.js';
import { initTheme } from './theme.js';
import { VERSION } from '../version.js';
import { STRINGS } from './strings.js';

const VIEWS = {
  pokedex: pokedexView,
  movimientos: movesView,
  naturalezas: naturesView,
  objetos: itemsView,
  bayas: berriesView,
  tipos: typesView,
  habilidades: abilitiesView,
};

function storageOrNull(name) {
  try {
    return window[name];
  } catch {
    return null;
  }
}

const fetchJson = createFetchJson({
  cache: createApiCache({
    local: storageOrNull('localStorage'),
    session: storageOrNull('sessionStorage'),
  }),
});
let lastLoadAborted = false;

async function start() {
  const sectionName = document.body.dataset.section;
  const view = VIEWS[sectionName];
  const parsedQuery = parseQuery(window.location.search);
  const status = document.querySelector('[data-estado]');
  const content = document.querySelector('[data-contenido]');
  document.querySelector('[data-cabecera]').innerHTML = pageHeader(
    view.title,
    view.searchable,
    parsedQuery.query === null ? '' : parsedQuery.rawQuery,
  );

  status.textContent = STRINGS.comun.cargando;
  content.innerHTML = '';
  const result = await loadUntilPageHide(window, (signal) =>
    loadSection(
      (url) => fetchJson(url, { signal }).then((json) => ({ ok: true, status: 200, json })),
      SECTIONS[sectionName],
      parsedQuery,
    ),
  );
  lastLoadAborted = result === null;
  if (lastLoadAborted) return;
  status.textContent = statusText(result);
  content.innerHTML = sectionBody(view, result);
  applyStatBarWidths(content);
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted && lastLoadAborted) start();
});

document.querySelector('[data-version]').textContent = VERSION;
initTheme(document, storageOrNull('localStorage'));
start();
