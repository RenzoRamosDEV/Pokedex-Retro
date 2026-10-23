// @ts-check

const BACKOFF_BASE_MS = 500;

/**
 * @typedef {{ get(url: string): unknown, set(url: string, value: unknown): unknown }} JsonCache
 * @typedef {{ ok: boolean, status: number, json(): Promise<unknown> }} ResponseLike
 * @typedef {(url: string, init: { signal: AbortSignal }) => Promise<ResponseLike>} FetchLike
 */

/**
 * @param {{ fetch?: FetchLike, cache?: JsonCache, timeoutMs?: number, retries?: number }} [options]
 */
export function createFetchJson({ fetch, cache, timeoutMs = 10000, retries = 2 } = {}) {
  /**
   * @param {string} url
   * @param {{ signal?: AbortSignal }} [options]
   */
  return async function fetchJson(url, { signal } = {}) {
    const cached = cache?.get(url);
    if (cached !== undefined) return cached;

    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), timeoutMs);
    const combined = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
    try {
      const fetchImpl = fetch ?? /** @type {FetchLike} */ (globalThis.fetch);
      const json = await fetchWithRetries(fetchImpl, url, combined, retries);
      cache?.set(url, json);
      return json;
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Petición cancelada', 'AbortError');
      if (deadline.signal.aborted) throw new DOMException('Tiempo agotado', 'TimeoutError');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * @param {FetchLike} fetchImpl
 * @param {string} url
 * @param {AbortSignal} signal
 * @param {number} retries
 */
async function fetchWithRetries(fetchImpl, url, signal, retries) {
  for (let attempt = 0; ; attempt += 1) {
    signal.throwIfAborted();
    try {
      return await fetchOnce(fetchImpl, url, signal);
    } catch (error) {
      if (attempt >= retries || !isRetriable(error) || signal.aborted) throw error;
    }
    await waitBackoff(BACKOFF_BASE_MS * 2 ** attempt, signal);
  }
}

/**
 * @param {FetchLike} fetchImpl
 * @param {string} url
 * @param {AbortSignal} signal
 */
async function fetchOnce(fetchImpl, url, signal) {
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw httpError(response.status);
  return response.json();
}

/** @param {number} status */
function httpError(status) {
  const error = new Error(`HTTP ${status}`);
  error.name = 'HttpError';
  return Object.assign(error, { status });
}

/** @param {any} error */
function isRetriable(error) {
  if (error.name === 'HttpError') return error.status === 429 || error.status >= 500;
  return error instanceof TypeError;
}

/**
 * The listener needs no removal: `signal` is created per call and is discarded with it.
 * @param {number} ms
 * @param {AbortSignal} signal
 */
function waitBackoff(ms, signal) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
    signal.addEventListener('abort', () => reject(signal.reason));
  });
}
