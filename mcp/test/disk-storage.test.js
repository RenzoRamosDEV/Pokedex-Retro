import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createListCache } from '../../site/js/api/cache.js';
import { createDiskStorage } from '../src/disk-storage.js';

const URL_PIKACHU = 'https://pokeapi.co/api/v2/pokemon/pikachu';
const SHA_PIKACHU = createHash('sha256').update(URL_PIKACHU).digest('hex');

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pokedex-mcp-'));
  t.after(() => {
    chmodSync(dir, 0o700);
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

function recorder() {
  const lines = [];
  const record = (level) => (message) => lines.push(`${level}: ${message}`);
  return { lines, log: { error: record('error'), info: record('info'), debug: record('debug') } };
}

test('setItem writes <sha256 of the key>.json, creating the directory', (t) => {
  const dir = join(tempDir(t), 'pokedex-mcp');
  const storage = createDiskStorage({ dir, log: recorder().log });
  storage.setItem(URL_PIKACHU, '{"t":1,"data":{}}');
  assert.equal(readFileSync(join(dir, `${SHA_PIKACHU}.json`), 'utf8'), '{"t":1,"data":{}}');
});

test('getItem returns what setItem stored', (t) => {
  const storage = createDiskStorage({ dir: tempDir(t), log: recorder().log });
  storage.setItem('clave', 'valor');
  assert.equal(storage.getItem('clave'), 'valor');
});

test('getItem of a missing key returns null without logging', (t) => {
  const { lines, log } = recorder();
  const storage = createDiskStorage({ dir: tempDir(t), log });
  assert.equal(storage.getItem(URL_PIKACHU), null);
  assert.deepEqual(lines, []);
});

test('getItem on an unreadable entry returns null and logs one error', (t) => {
  const dir = tempDir(t);
  mkdirSync(join(dir, `${SHA_PIKACHU}.json`));
  const { lines, log } = recorder();
  assert.equal(createDiskStorage({ dir, log }).getItem(URL_PIKACHU), null);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^error: caché en disco: /);
});

test(
  'setItem on a read-only directory does not throw and logs one error',
  { skip: process.getuid?.() === 0 && 'root ignora los permisos' },
  (t) => {
    const dir = tempDir(t);
    chmodSync(dir, 0o500);
    const { lines, log } = recorder();
    assert.doesNotThrow(() => createDiskStorage({ dir, log }).setItem(URL_PIKACHU, '{}'));
    assert.equal(existsSync(join(dir, `${SHA_PIKACHU}.json`)), false);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^error: caché en disco: /);
  },
);

test('a corrupt file is a cache miss for createListCache', (t) => {
  const dir = tempDir(t);
  writeFileSync(join(dir, `${SHA_PIKACHU}.json`), '{ no es json');
  const storage = createDiskStorage({ dir, log: recorder().log });
  const cache = createListCache({ storage, prefix: '', now: () => 0 });
  assert.equal(cache.get(URL_PIKACHU), undefined);
});
