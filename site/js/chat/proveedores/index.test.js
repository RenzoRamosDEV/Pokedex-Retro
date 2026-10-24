import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROVEEDORES, PROVEEDOR_POR_DEFECTO } from './index.js';
import { anthropic } from './anthropic.js';

test('registers the Anthropic adapter', () => {
  assert.equal(PROVEEDORES.anthropic, anthropic);
});

test('the default provider is anthropic', () => {
  assert.equal(PROVEEDOR_POR_DEFECTO, 'anthropic');
  assert.equal(PROVEEDORES[PROVEEDOR_POR_DEFECTO], anthropic);
});
