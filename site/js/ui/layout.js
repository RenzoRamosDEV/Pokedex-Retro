import { escapeHtml } from '../core/html.js';

export function pageHeader(title, searchable, searchValue) {
  const searchForm = searchable
    ? `
    <form class="search-form" method="GET">
      <input class="search-input" type="text" name="q" placeholder="BUSCAR..." value="${escapeHtml(searchValue)}" autocomplete="off">
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
  const prev = links.prevHref === null
    ? '<span class="page-btn disabled">◀ PREV</span>'
    : `<a href="${escapeHtml(links.prevHref)}" class="page-btn">◀ PREV</a>`;
  const next = links.nextHref === null
    ? '<span class="page-btn disabled">NEXT ▶</span>'
    : `<a href="${escapeHtml(links.nextHref)}" class="page-btn">NEXT ▶</a>`;
  return `
  <nav class="pagination">
    ${prev}
    <span class="page-info">${links.page} / ${links.total}</span>
    ${next}
  </nav>`;
}

export const upper = (value) => escapeHtml(String(value).toUpperCase());
