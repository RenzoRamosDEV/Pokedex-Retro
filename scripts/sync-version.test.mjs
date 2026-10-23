import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderVersionModule, syncVersion } from './sync-version.mjs';

const GOLDEN_1_0_1 =
  '// Fichero generado por scripts/sync-version.mjs a partir de package.json. No editar a mano.\n' +
  "export const VERSION = '1.0.1';\n";

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-version-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('renderVersionModule matches the golden text', () => {
  assert.equal(renderVersionModule('1.0.1'), GOLDEN_1_0_1);
});

test('syncVersion writes the module for the package.json version', (t) => {
  const dir = tempDir(t);
  const packageJsonPath = join(dir, 'package.json');
  const outputPath = join(dir, 'version.js');
  writeFileSync(packageJsonPath, JSON.stringify({ name: 'x', version: '1.0.1' }));
  syncVersion({ packageJsonPath, outputPath });
  assert.equal(readFileSync(outputPath, 'utf8'), GOLDEN_1_0_1);
});

test('syncVersion fails with a descriptive error without version', (t) => {
  const dir = tempDir(t);
  const packageJsonPath = join(dir, 'package.json');
  const outputPath = join(dir, 'version.js');
  writeFileSync(packageJsonPath, JSON.stringify({ name: 'x' }));
  assert.throws(() => syncVersion({ packageJsonPath, outputPath }), {
    message: `${packageJsonPath} no declara el campo "version"`,
  });
});

function fakeRepo(t, version) {
  const root = tempDir(t);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'site', 'js'), { recursive: true });
  cpSync(join(import.meta.dirname, 'sync-version.mjs'), join(root, 'scripts', 'sync-version.mjs'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version }));
  return root;
}

test('the CLI regenerates site/js/version.js from the repo package.json', (t) => {
  const root = fakeRepo(t, '1.0.1');
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'sync-version.mjs')], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(root, 'site', 'js', 'version.js'), 'utf8'), GOLDEN_1_0_1);
});

test('importing the module does not regenerate the file', (t) => {
  const root = fakeRepo(t, '1.0.1');
  const importer = join(root, 'importer.mjs');
  const moduleUrl = pathToFileURL(join(root, 'scripts', 'sync-version.mjs')).href;
  writeFileSync(importer, `await import(${JSON.stringify(moduleUrl)});\n`);
  const result = spawnSync(process.execPath, [importer], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(root, 'site', 'js', 'version.js')), false);
});
