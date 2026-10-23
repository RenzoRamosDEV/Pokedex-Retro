import { parseQuery } from '../core/query.js';
import { SECTIONS } from '../core/sections.js';
import { loadSection } from '../core/load-section.js';
import { paginationLinks } from '../core/pagination.js';
import { pageHeader, statusMessage, paginationNav } from './layout.js';
import { pokedexView } from './render-pokedex.js';
import { movesView } from './render-moves.js';
import { naturesView } from './render-natures.js';
import { itemsView } from './render-items.js';
import { berriesView } from './render-berries.js';
import { typesView } from './render-types.js';
import { abilitiesView } from './render-abilities.js';
import { createFetchJson } from '../api/client.js';
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

const fetchJson = createFetchJson({});
let lastLoadAborted = false;

function localStorageOrNull() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function renderContent(view, result) {
  if (result.status === 'error') return statusMessage(STRINGS.comun.errorCarga);
  if (result.items.length === 0) return statusMessage(STRINGS.comun.sinResultados);
  const overlays = view.renderOverlays ? view.renderOverlays(result.items) : '';
  return (
    view.renderItems(result.items) +
    paginationNav(paginationLinks(result.page, result.totalPages, result.rawQuery)) +
    overlays
  );
}

async function start() {
  const sectionName = document.body.dataset.section;
  const view = VIEWS[sectionName];
  const parsedQuery = parseQuery(window.location.search);
  const main = document.querySelector('.site-main');
  const header = pageHeader(
    view.title,
    view.searchable,
    parsedQuery.query === null ? '' : parsedQuery.rawQuery,
  );

  main.innerHTML = header + statusMessage(STRINGS.comun.cargando);
  const result = await loadUntilPageHide(window, (signal) =>
    loadSection(
      (url) => fetchJson(url, { signal }).then((json) => ({ ok: true, status: 200, json })),
      SECTIONS[sectionName],
      parsedQuery,
    ),
  );
  lastLoadAborted = result === null;
  if (lastLoadAborted) return;
  main.innerHTML = header + renderContent(view, result);
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted && lastLoadAborted) start();
});

document.querySelector('[data-version]').textContent = VERSION;
initTheme(document, localStorageOrNull());
start();
