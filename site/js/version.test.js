import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION } from './version.js';

test('VERSION matches the version in package.json', () => {
  const packageJson = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'),
  );
  assert.equal(
    VERSION,
    packageJson.version,
    `site/js/version.js exporta ${VERSION} y package.json declara ${packageJson.version}; ejecuta node scripts/sync-version.mjs`,
  );
});
