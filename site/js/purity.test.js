import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const PURE_DIRS = ['core', 'mappers'];

const modulesIn = (dir) =>
  readdirSync(join(import.meta.dirname, dir))
    .filter((file) => file.endsWith('.js') && !file.endsWith('.test.js'))
    .sort();

test('Node offers no DOM globals', () => {
  assert.equal(globalThis.window, undefined);
  assert.equal(globalThis.document, undefined);
});

for (const dir of PURE_DIRS) {
  test(`${dir} modules import without a DOM`, async (t) => {
    for (const file of modulesIn(dir)) {
      await t.test(file, async () => {
        await import(`./${dir}/${file}`);
      });
    }
  });
}
