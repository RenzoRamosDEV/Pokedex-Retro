import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION } from '../site/js/version.js';

const ROOT = join(import.meta.dirname, '..');
const PUBLISHED_VERSION_HEADING = /^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/m;

const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
const latestChangelogVersion = () =>
  readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8').match(PUBLISHED_VERSION_HEADING)?.[1];

function declaredVersions() {
  const rootLock = readJson('package-lock.json');
  const mcpLock = readJson('mcp/package-lock.json');
  const server = readJson('mcp/server.json');
  return [
    ['package-lock.json', 'version', rootLock.version],
    ['package-lock.json', 'packages[""].version', rootLock.packages[''].version],
    ['mcp/package.json', 'version', readJson('mcp/package.json').version],
    ['mcp/package-lock.json', 'version', mcpLock.version],
    ['mcp/package-lock.json', 'packages[""].version', mcpLock.packages[''].version],
    ['mcp/server.json', 'version', server.version],
    ...server.packages.map((entry, index) => [
      'mcp/server.json',
      `packages[${index}].version`,
      entry.version,
    ]),
    ['site/js/version.js', 'VERSION', VERSION],
    ['CHANGELOG.md', 'última versión publicada', latestChangelogVersion()],
  ];
}

test('every manifest, lockfile, the site and the changelog declare the package.json version', () => {
  const reference = readJson('package.json').version;
  const divergent = declaredVersions()
    .filter(([, , value]) => value !== reference)
    .map(([file, field, value]) => `${file} (${field}): ${value} ≠ ${reference}`);
  assert.deepEqual(divergent, []);
});

test('the changelog publishes at least one version', () => {
  assert.match(latestChangelogVersion() ?? '', /^\d+\.\d+\.\d+/);
});
