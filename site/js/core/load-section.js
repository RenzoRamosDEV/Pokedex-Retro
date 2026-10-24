// @ts-check
import { filterByName } from './search.js';
import { offsetFor, sliceFor, totalPages } from './pagination.js';
import { createLimit } from './limit.js';

const API_BASE = 'https://pokeapi.co/api/v2';
export const FULL_LIST_LIMIT = 100000;
const MAX_DETAIL_REQUESTS = 6;

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
    return { entries, page: 1, totalPages: Math.min(entries.length, 1), total: entries.length };
  }
  if (query !== null) {
    const { results } = await fetchList(fetchJson, `${resourceUrl}?limit=${FULL_LIST_LIMIT}`);
    const matches = filterByName(results, query);
    return {
      entries: sliceFor(matches, page, config.pageSize),
      page,
      totalPages: totalPages(matches.length, config.pageSize),
      total: matches.length,
    };
  }
  const offset = offsetFor(page, config.pageSize);
  const { count, results } = await fetchList(
    fetchJson,
    `${resourceUrl}?limit=${config.pageSize}&offset=${offset}`,
  );
  return { entries: results, page, totalPages: totalPages(count, config.pageSize), total: count };
}

export async function fetchDetail(fetchJson, config, name) {
  const url = `${API_BASE}/${config.resource}/${name}`;
  const response = await fetchJson(url);
  if (!response.ok) throw new Error(`Detail request failed: ${url}`);
  return config.mapper(response.json);
}

export async function loadSection(fetchJson, config, parsedQuery) {
  let listing;
  try {
    listing = await fetchListing(fetchJson, config, parsedQuery);
  } catch {
    return { status: 'error' };
  }
  const names = listing.entries
    .map((entry) => entry.name)
    .filter((name) => !config.exclude.includes(name));
  const run = createLimit(MAX_DETAIL_REQUESTS);
  const details = await Promise.allSettled(
    names.map((name) => run(() => fetchDetail(fetchJson, config, name))),
  );
  const loaded = details.filter((detail) => detail.status === 'fulfilled');
  return {
    status: 'ok',
    items: loaded.map((detail) => detail.value).sort((a, b) => a.id - b.id),
    page: listing.page,
    totalPages: listing.totalPages,
    total: listing.total,
    rawQuery: parsedQuery.query === null ? null : parsedQuery.rawQuery,
    failedCount: details.length - loaded.length,
  };
}
