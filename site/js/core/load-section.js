// @ts-check
import { filterByName } from './search.js';
import { offsetFor, sliceFor, totalPages } from './pagination.js';

const API_BASE = 'https://pokeapi.co/api/v2';
const FULL_LIST_LIMIT = 100000;

async function fetchList(fetchJson, url) {
  const response = await fetchJson(url);
  if (!response.ok || !Array.isArray(response.json.results)) {
    throw new Error(`List request failed: ${url}`);
  }
  return response.json;
}

async function fetchListing(fetchJson, config, { page, query }) {
  const resourceUrl = `${API_BASE}/${config.resource}`;
  if (config.pageSize === null) {
    const { results } = await fetchList(fetchJson, `${resourceUrl}?limit=${config.listLimit}`);
    const entries = filterByName(results, query);
    return { entries, page: 1, totalPages: Math.min(entries.length, 1) };
  }
  if (query !== null) {
    const { results } = await fetchList(fetchJson, `${resourceUrl}?limit=${FULL_LIST_LIMIT}`);
    const matches = filterByName(results, query);
    return {
      entries: sliceFor(matches, page, config.pageSize),
      page,
      totalPages: totalPages(matches.length, config.pageSize),
    };
  }
  const offset = offsetFor(page, config.pageSize);
  const { count, results } = await fetchList(fetchJson, `${resourceUrl}?limit=${config.pageSize}&offset=${offset}`);
  return { entries: results, page, totalPages: totalPages(count, config.pageSize) };
}

async function fetchDetail(fetchJson, config, name) {
  try {
    const response = await fetchJson(`${API_BASE}/${config.resource}/${name}`);
    return response.ok ? config.mapper(response.json) : null;
  } catch {
    return null;
  }
}

export async function loadSection(fetchJson, config, parsedQuery) {
  let listing;
  try {
    listing = await fetchListing(fetchJson, config, parsedQuery);
  } catch {
    return { status: 'error' };
  }
  const names = listing.entries.map((entry) => entry.name).filter((name) => !config.exclude.includes(name));
  const details = await Promise.all(names.map((name) => fetchDetail(fetchJson, config, name)));
  return {
    status: 'ok',
    items: details.filter((item) => item !== null).sort((a, b) => a.id - b.id),
    page: listing.page,
    totalPages: listing.totalPages,
    rawQuery: parsedQuery.query === null ? null : parsedQuery.rawQuery,
  };
}
