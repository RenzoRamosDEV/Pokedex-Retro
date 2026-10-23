import { escapeHtml } from '../core/html.js';
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

export function statusMessage(text) {
  return `<p class="page-info">${escapeHtml(text)}</p>`;
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
