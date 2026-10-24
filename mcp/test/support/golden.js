import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Compares `actual` (as JSON, so undefined keys drop) with a JSON golden file in `mcp/test/fixtures`; `UPDATE_GOLDEN=1` rewrites it.
 * @param {string} name
 * @param {unknown} actual
 */
export function assertGolden(name, actual) {
  const url = new URL(`../fixtures/${name}`, import.meta.url);
  const json = JSON.stringify(actual, null, 2);
  if (process.env.UPDATE_GOLDEN === '1') {
    writeFileSync(url, `${json}\n`);
    return;
  }
  assert.deepEqual(JSON.parse(json), JSON.parse(readFileSync(url, 'utf8')));
}
