import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGifLimits } from './capture-demo.mjs';

const SIZE_EXCEEDED = 'demo.gif pesa 3000001 bytes (máximo 3000000)';
const DURATION_EXCEEDED = 'demo.gif dura 15.001 s (máximo 15)';

test('a GIF exactly at both limits passes', () => {
  assert.deepEqual(checkGifLimits({ bytes: 3000000, seconds: 15 }), []);
});

test('an empty, zero-length GIF passes', () => {
  assert.deepEqual(checkGifLimits({ bytes: 0, seconds: 0 }), []);
});

test('one byte over the size limit is reported with the measured size', () => {
  assert.deepEqual(checkGifLimits({ bytes: 3000001, seconds: 15 }), [SIZE_EXCEEDED]);
});

test('a millisecond over the duration limit is reported with the measured duration', () => {
  assert.deepEqual(checkGifLimits({ bytes: 3000000, seconds: 15.001 }), [DURATION_EXCEEDED]);
});

test('both limits exceeded are reported in size, duration order', () => {
  assert.deepEqual(checkGifLimits({ bytes: 3000001, seconds: 15.001 }), [
    SIZE_EXCEEDED,
    DURATION_EXCEEDED,
  ]);
});

function fakeRepo(t) {
  const root = mkdtempSync(join(tmpdir(), 'capture-demo-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'site'));
  for (const script of ['capture-demo.mjs', 'serve-site.mjs']) {
    cpSync(join(import.meta.dirname, script), join(root, 'scripts', script));
  }
  return root;
}

test('importing the module does not capture the demo', (t) => {
  const root = fakeRepo(t);
  const importer = join(root, 'importer.mjs');
  const moduleUrl = pathToFileURL(join(root, 'scripts', 'capture-demo.mjs')).href;
  writeFileSync(importer, `await import(${JSON.stringify(moduleUrl)});\n`);
  const result = spawnSync(process.execPath, [importer], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(root, 'docs', 'media', 'demo.gif')), false);
});
