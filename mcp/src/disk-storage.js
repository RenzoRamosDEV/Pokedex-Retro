// @ts-check
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Synchronous `StorageLike` that keeps each key in `<dir>/<sha256 of the key>.json`.
 * It never throws: `createListCache` would swallow the error without logging it.
 * @param {{ dir: string, log: import('./log.js').Logger }} options
 * @returns {import('../../site/js/api/cache.js').StorageLike}
 */
export function createDiskStorage({ dir, log }) {
  /** @param {string} key */
  const fileFor = (key) => join(dir, `${createHash('sha256').update(key).digest('hex')}.json`);
  return {
    getItem(key) {
      try {
        return readFileSync(fileFor(key), 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') log.error(`caché en disco: ${error.message}`);
        return null;
      }
    },
    setItem(key, value) {
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(fileFor(key), value);
      } catch (error) {
        log.error(`caché en disco: ${error.message}`);
      }
    },
  };
}
