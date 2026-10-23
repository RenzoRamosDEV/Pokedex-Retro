// @ts-check
import { normalizeQuery } from './search.js';

const POSITIVE_INTEGER = /^[1-9]\d*$/;

export function parseQuery(search) {
  const params = new URLSearchParams(search);
  const pageParam = params.get('page');
  const rawQuery = params.get('q');
  return {
    page: POSITIVE_INTEGER.test(pageParam) ? Number(pageParam) : 1,
    rawQuery,
    query: normalizeQuery(rawQuery),
  };
}
