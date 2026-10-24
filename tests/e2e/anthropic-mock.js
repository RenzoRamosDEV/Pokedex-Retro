import { serializar } from '../support/claude-sse.js';

/** CORS headers api.anthropic.com answered to the real preflight on 2026-10-24. */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'x-api-key,anthropic-version,content-type,anthropic-dangerous-direct-browser-access,anthropic-beta',
  'access-control-allow-methods': 'POST, OPTIONS',
};

/**
 * Simulates the Messages API. Each POST takes the next step of `pasos`:
 * `{ eventos }` streams SSE events, `{ status, type, message }` answers a JSON error and
 * `{ retener: true }` holds the request until `soltar()` (or never). Every POST is recorded.
 * @param {import('@playwright/test').Page} page
 */
export async function mockAnthropic(page, pasos = []) {
  const record = { posts: [], preflights: 0 };
  let soltar = () => {};
  await page.route('https://api.anthropic.com/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      record.preflights += 1;
      return route.fulfill({ status: 200, headers: CORS });
    }
    record.posts.push({ headers: request.headers(), body: request.postDataJSON() });
    const paso = pasos.shift() ?? { status: 500, type: 'api_error', message: 'sin paso' };
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
      json: { type: 'error', error: { type: paso.type, message: paso.message } },
    });
  });
  record.soltar = () => soltar();
  return record;
}
