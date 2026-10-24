import { serializar } from '../support/openai-sse.js';

/** CORS headers api.openai.com answered to the real preflight on 2026-10-24. */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET, POST, HEAD, PUT, DELETE, OPTIONS, PATCH',
};

/**
 * Simulates the Responses API. Each POST takes the next step of `pasos`:
 * `{ eventos }` streams SSE events, `{ status, error }` answers a JSON error and
 * `{ retener: true }` holds the request until `soltar()` (or never). Every POST is recorded.
 * @param {import('@playwright/test').Page} page
 */
export async function mockOpenai(page, pasos = []) {
  const record = { posts: [], preflights: 0 };
  let soltar = () => {};
  await page.route('https://api.openai.com/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      record.preflights += 1;
      return route.fulfill({ status: 200, headers: CORS });
    }
    record.posts.push({ headers: request.headers(), body: request.postDataJSON() });
    const paso = pasos.shift() ?? { status: 500, error: { message: 'sin paso' } };
    if (paso.retener) {
      await new Promise((resolve) => {
        soltar = resolve;
      });
      return route.abort().catch(() => {});
    }
    if (paso.eventos) {
      return route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'text/event-stream' },
        body: serializar(paso.eventos),
      });
    }
    return route.fulfill({
      status: paso.status,
      headers: CORS,
      json: { error: { type: null, code: null, param: null, ...paso.error } },
    });
  });
  record.soltar = () => soltar();
  return record;
}
