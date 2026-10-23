import './theme.js';
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

const VIEWS = {
  pokedex: pokedexView,
  movimientos: movesView,
  naturalezas: naturesView,
  objetos: itemsView,
  bayas: berriesView,
  tipos: typesView,
  habilidades: abilitiesView,
};

const LOADING_MESSAGE = 'CARGANDO...';
const EMPTY_MESSAGE = 'SIN RESULTADOS';
const ERROR_MESSAGE = 'No se pudieron cargar los datos. Inténtalo de nuevo más tarde.';

async function fetchJson(url) {
  const response = await fetch(url);
  return { ok: response.ok, status: response.status, json: response.ok ? await response.json() : null };
}

function renderContent(view, result) {
  if (result.status === 'error') return statusMessage(ERROR_MESSAGE);
  if (result.items.length === 0) return statusMessage(EMPTY_MESSAGE);
  const overlays = view.renderOverlays ? view.renderOverlays(result.items) : '';
  return view.renderItems(result.items)
    + paginationNav(paginationLinks(result.page, result.totalPages, result.rawQuery))
    + overlays;
}

async function start() {
  const sectionName = document.body.dataset.section;
  const view = VIEWS[sectionName];
  const parsedQuery = parseQuery(window.location.search);
  const main = document.querySelector('.site-main');
  const header = pageHeader(view.title, view.searchable, parsedQuery.query === null ? '' : parsedQuery.rawQuery);

  main.innerHTML = header + statusMessage(LOADING_MESSAGE);
  const result = await loadSection(fetchJson, SECTIONS[sectionName], parsedQuery);
  main.innerHTML = header + renderContent(view, result);
}

start();
