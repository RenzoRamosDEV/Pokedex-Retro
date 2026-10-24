// @ts-check

const SIGNALS = ['SIGINT', 'SIGTERM'];

/**
 * On the first SIGINT/SIGTERM, closes and exits with 0; `graceMs` bounds a close that never settles.
 * @param {{
 *   target: { on(event: string, listener: () => void): unknown },
 *   close: () => Promise<unknown>,
 *   exit: (code: number) => void,
 *   log: import('./log.js').Logger,
 *   graceMs: number,
 * }} options
 */
export function installShutdown({ target, close, exit, log, graceMs }) {
  let closing = false;
  /** @param {string} signal */
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    log.info(`cerrando por ${signal}`);
    const forced = setTimeout(() => exit(0), graceMs);
    try {
      await close();
    } catch (error) {
      log.error(`cierre incompleto: ${error.message}`);
    }
    clearTimeout(forced);
    exit(0);
  };
  for (const signal of SIGNALS) target.on(signal, () => shutdown(signal));
}
