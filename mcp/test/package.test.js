import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const pkg = readJson('../package.json');
const server = readJson('../server.json');
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const RUNTIME_DEPENDENCIES = ['@modelcontextprotocol/sdk', 'zod'];

test('package.json declares the package metadata', () => {
  assert.equal(pkg.name, 'pokedex-retro-mcp');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.bin, { 'pokedex-retro-mcp': 'bin/pokedex-mcp.js' });
  assert.deepEqual(pkg.files, ['bin', 'src']);
  assert.deepEqual(pkg.exports, { '.': './src/server.js' });
  assert.equal(pkg.engines.node, '>=22');
  assert.equal(pkg.mcpName, 'io.github.renzoramosdev/pokedex-retro');
});

test('only the SDK and zod are runtime dependencies, with exact versions', () => {
  const extra = Object.keys(pkg.dependencies).filter((n) => !RUNTIME_DEPENDENCIES.includes(n));
  assert.deepEqual(extra, [], `dependencias no permitidas: ${extra.join(', ')}`);
  for (const name of RUNTIME_DEPENDENCIES) {
    assert.match(pkg.dependencies[name] ?? '', EXACT_VERSION, `${name} sin versión exacta`);
  }
  assert.equal(pkg.devDependencies, undefined);
});

test('server.json matches the registry name pattern and the package version', () => {
  assert.equal(server.name, pkg.mcpName);
  assert.match(server.name, /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
  assert.ok(server.description.length > 0 && server.description.length <= 100);
  assert.equal(server.version, pkg.version);
  assert.equal(server.packages.length, 1);
  assert.equal(server.packages[0].registryType, 'npm');
  assert.equal(server.packages[0].identifier, pkg.name);
  assert.equal(server.packages[0].version, pkg.version);
  assert.deepEqual(server.packages[0].transport, { type: 'stdio' });
});

test('the binary starts with a node shebang', () => {
  const source = readFileSync(new URL('../bin/pokedex-mcp.js', import.meta.url), 'utf8');
  assert.equal(source.split('\n')[0], '#!/usr/bin/env node');
});
