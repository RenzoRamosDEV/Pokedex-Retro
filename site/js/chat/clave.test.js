import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAVE_ALMACENAMIENTO,
  CLAVES_ALMACENAMIENTO,
  esClaveValida,
  guardarClave,
  leerClave,
  olvidarClave,
  validarClave,
} from './clave.js';

function almacen(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
  };
}

const roto = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
  removeItem() {
    throw new Error('SecurityError');
  },
};

const K = 'pokedex:chat:apikey';
const contenido = (a) => Object.fromEntries(a.datos);

describe('esClaveValida', () => {
  for (const [texto, esperado] of [
    ['', false],
    ['   ', false],
    ['abc123', false],
    ['sk-ant', false],
    ['sk-ant-', true],
    ['sk-ant-x', true],
    [' sk-ant-x ', true],
    ['SK-ANT-x', false],
  ]) {
    test(`${JSON.stringify(texto)} is ${esperado ? 'valid' : 'invalid'}`, () => {
      assert.equal(esClaveValida(texto), esperado);
    });
  }
});

describe('key storage', () => {
  test('uses the storage key pokedex:chat:apikey', () => {
    assert.equal(CLAVE_ALMACENAMIENTO, K);
  });

  test('without remembering keeps the key only in the session and forgets the local copy', () => {
    const session = almacen();
    const local = almacen({ [K]: 'sk-ant-vieja' });
    guardarClave({ session, local }, 'sk-ant-x', false);
    assert.deepEqual(contenido(session), { [K]: 'sk-ant-x' });
    assert.deepEqual(contenido(local), {});
  });

  test('remembering keeps the key only locally and forgets the session copy', () => {
    const session = almacen({ [K]: 'sk-ant-vieja' });
    const local = almacen();
    guardarClave({ session, local }, 'sk-ant-x', true);
    assert.deepEqual(contenido(session), {});
    assert.deepEqual(contenido(local), { [K]: 'sk-ant-x' });
  });

  test('moves the key back to the session when remembering is unchecked', () => {
    const almacenes = { session: almacen(), local: almacen() };
    guardarClave(almacenes, 'sk-ant-x', true);
    guardarClave(almacenes, 'sk-ant-x', false);
    assert.deepEqual(contenido(almacenes.session), { [K]: 'sk-ant-x' });
    assert.deepEqual(contenido(almacenes.local), {});
  });

  test('reads the session key first', () => {
    const almacenes = {
      session: almacen({ [K]: 'sk-ant-s' }),
      local: almacen({ [K]: 'sk-ant-l' }),
    };
    assert.equal(leerClave(almacenes), 'sk-ant-s');
  });

  test('reads the local key when the session has none', () => {
    assert.equal(
      leerClave({ session: almacen(), local: almacen({ [K]: 'sk-ant-l' }) }),
      'sk-ant-l',
    );
  });

  test('reads null when no storage has a key', () => {
    assert.equal(leerClave({ session: almacen(), local: almacen() }), null);
  });

  test('forgets the key in both storages', () => {
    const almacenes = { session: almacen({ [K]: 'a', otra: '1' }), local: almacen({ [K]: 'b' }) };
    olvidarClave(almacenes);
    assert.deepEqual(contenido(almacenes.session), { otra: '1' });
    assert.deepEqual(contenido(almacenes.local), {});
  });

  for (const [nombre, almacenes] of [
    ['missing', { session: null, local: null }],
    ['throwing', { session: roto, local: roto }],
  ]) {
    test(`${nombre} storages never throw and read null`, () => {
      assert.doesNotThrow(() => guardarClave(almacenes, 'sk-ant-x', false));
      assert.doesNotThrow(() => guardarClave(almacenes, 'sk-ant-x', true));
      assert.doesNotThrow(() => olvidarClave(almacenes));
      assert.equal(leerClave(almacenes), null);
    });
  }

  test('falls back to the local key when the session storage throws', () => {
    assert.equal(leerClave({ session: roto, local: almacen({ [K]: 'sk-ant-l' }) }), 'sk-ant-l');
  });

  test('still writes the session copy when the local storage throws', () => {
    const session = almacen();
    guardarClave({ session, local: roto }, 'sk-ant-x', false);
    assert.deepEqual(contenido(session), { [K]: 'sk-ant-x' });
  });
});

describe('validarClave', () => {
  const casos = [
    ['', 'formato', 'formato'],
    ['   ', 'formato', 'formato'],
    ['abc123', 'formato', 'formato'],
    ['sk-', 'otro_proveedor', 'ok'],
    ['sk-x', 'otro_proveedor', 'ok'],
    ['sk-proj-x', 'otro_proveedor', 'ok'],
    ['sk-ant', 'otro_proveedor', 'ok'],
    ['sk-ant-', 'ok', 'otro_proveedor'],
    ['sk-ant-x', 'ok', 'otro_proveedor'],
    [' sk-ant-x ', 'ok', 'otro_proveedor'],
    ['SK-x', 'formato', 'formato'],
  ];
  for (const [texto, anthropic, openai] of casos) {
    test(`"${texto}" is ${anthropic} for anthropic and ${openai} for openai`, () => {
      assert.equal(validarClave('anthropic', texto), anthropic);
      assert.equal(validarClave('openai', texto), openai);
    });
  }
});

describe('storage key per provider', () => {
  const KO = 'pokedex:chat:apikey:openai';

  test('names one storage key per provider', () => {
    assert.deepEqual(CLAVES_ALMACENAMIENTO, { anthropic: K, openai: KO });
  });

  test('saves, reads and forgets the OpenAI key without touching the Anthropic one', () => {
    const session = almacen({ [K]: 'sk-ant-a' });
    const local = almacen({ [K]: 'sk-ant-b' });
    guardarClave({ session, local }, 'sk-proj-x', false, KO);
    assert.deepEqual(contenido(session), { [K]: 'sk-ant-a', [KO]: 'sk-proj-x' });
    assert.equal(leerClave({ session, local }, KO), 'sk-proj-x');
    guardarClave({ session, local }, 'sk-proj-y', true, KO);
    assert.deepEqual(contenido(session), { [K]: 'sk-ant-a' });
    assert.deepEqual(contenido(local), { [K]: 'sk-ant-b', [KO]: 'sk-proj-y' });
    assert.equal(leerClave({ session, local }, KO), 'sk-proj-y');
    olvidarClave({ session, local }, KO);
    assert.deepEqual(contenido(session), { [K]: 'sk-ant-a' });
    assert.deepEqual(contenido(local), { [K]: 'sk-ant-b' });
    assert.equal(leerClave({ session, local }, KO), null);
  });

  test('the Anthropic key calls do not touch the OpenAI key', () => {
    const session = almacen({ [KO]: 'sk-proj-a' });
    const local = almacen({ [KO]: 'sk-proj-b' });
    guardarClave({ session, local }, 'sk-ant-x', true, K);
    olvidarClave({ session, local }, K);
    assert.deepEqual(contenido(session), { [KO]: 'sk-proj-a' });
    assert.deepEqual(contenido(local), { [KO]: 'sk-proj-b' });
    assert.equal(leerClave({ session, local }), null);
  });

  test('calls without a storage key keep using the Anthropic one', () => {
    const session = almacen();
    const local = almacen();
    guardarClave({ session, local }, 'sk-ant-x', false);
    assert.deepEqual(contenido(session), { [K]: 'sk-ant-x' });
    assert.equal(leerClave({ session, local }), 'sk-ant-x');
    olvidarClave({ session, local });
    assert.deepEqual(contenido(session), {});
  });
});
