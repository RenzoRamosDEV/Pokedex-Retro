import { escapeHtml } from '../core/html.js';
import { paginationLinks } from '../core/pagination.js';
import { STRINGS } from './strings.js';

export function pageHeader(title, searchable, searchValue) {
  const searchForm = searchable
    ? `
    <form class="search-form" method="GET">
      <input class="search-input" type="text" name="q" placeholder="${STRINGS.comun.buscar}" value="${escapeHtml(searchValue)}" autocomplete="off">
      <button class="search-btn" type="submit">▶</button>
    </form>`
    : '';
  return `
  <div class="page-header">
    <h2 class="page-title">${escapeHtml(title)}</h2>${searchForm}
  </div>`;
}

export function paginationNav(links) {
  if (links === null) return '';
  const prev =
    links.prevHref === null
      ? `<span class="page-btn disabled">${STRINGS.comun.anterior}</span>`
      : `<a href="${escapeHtml(links.prevHref)}" class="page-btn">${STRINGS.comun.anterior}</a>`;
  const next =
    links.nextHref === null
      ? `<span class="page-btn disabled">${STRINGS.comun.siguiente}</span>`
      : `<a href="${escapeHtml(links.nextHref)}" class="page-btn">${STRINGS.comun.siguiente}</a>`;
  return `
  <nav class="pagination">
    ${prev}
    <span class="page-info">${links.page} / ${links.total}</span>
    ${next}
  </nav>`;
}

export const upper = (value) => escapeHtml(String(value).toUpperCase());

function failedText(count) {
  return count === 1
    ? STRINGS.comun.elementoNoCargado
    : `${count} ${STRINGS.comun.elementosNoCargados}`;
}

export function statusText(result) {
  if (result.status === 'error') return STRINGS.comun.errorCarga;
  if (result.failedCount > 0) return failedText(result.failedCount);
  if (result.items.length === 0) return STRINGS.comun.sinResultados;
  return '';
}

export function sectionBody(view, result) {
  if (result.status === 'error' || result.items.length === 0) return '';
  const overlays = view.renderOverlays ? view.renderOverlays(result.items) : '';
  return (
    view.renderItems(result.items) +
    paginationNav(paginationLinks(result.page, result.totalPages, result.rawQuery)) +
    overlays
  );
}

export function applyStatBarWidths(root) {
  root.querySelectorAll('[data-valor]').forEach((bar) => {
    bar.style.setProperty('--ancho', `${bar.dataset.valor}%`);
  });
}
