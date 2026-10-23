import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STRINGS } from './strings.js';

const UI_DIR = import.meta.dirname;
const GUARDED_FILES = [
  ...readdirSync(UI_DIR)
    .filter((file) => /^render-.*\.js$/.test(file) && !file.endsWith('.test.js'))
    .sort(),
  'layout.js',
  'main.js',
];

const LETTER = /\p{L}/u;
const UPPERCASE = /[A-ZÁÉÍÓÚÑ]/;
const VISIBLE_ATTRIBUTE = /\b(?:aria-label|placeholder|title|alt)="([^"]*)"/g;

function skipQuoted(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (source[i] !== quote) i += source[i] === '\\' ? 2 : 1;
  return { end: i + 1, text: source.slice(start + 1, i) };
}

function readTemplate(source, start, literals) {
  let text = '';
  let i = start + 1;
  while (source[i] !== '`') {
    if (source[i] === '\\') {
      text += source.slice(i, i + 2);
      i += 2;
    } else if (source[i] === '$' && source[i + 1] === '{') {
      i = readCode(source, i + 2, literals, '}');
    } else {
      text += source[i];
      i += 1;
    }
  }
  literals.push({ kind: 'template', text });
  return i + 1;
}

function readCode(source, start, literals, closer) {
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const char = source[i];
    if (char === closer && depth === 0) return i + 1;
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    if (char === "'" || char === '"') {
      const { end, text } = skipQuoted(source, i);
      literals.push({ kind: 'quoted', text });
      i = end;
    } else if (char === '`') {
      i = readTemplate(source, i, literals);
    } else if (char === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i);
      if (i === -1) return source.length;
    } else {
      i += 1;
    }
  }
  return i;
}

export function extractLiterals(source) {
  const literals = [];
  readCode(source, 0, literals, undefined);
  return literals;
}

function isVisibleText({ kind, text }) {
  if (kind === 'template' && text.includes('<')) {
    const textOutsideTags = text.replace(/<[^>]*>/g, '');
    const attributeValues = [...text.matchAll(VISIBLE_ATTRIBUTE)].map((match) => match[1]);
    return LETTER.test(textOutsideTags) || attributeValues.some((value) => LETTER.test(value));
  }
  return UPPERCASE.test(text);
}

export const visibleLiterals = (source) =>
  extractLiterals(source)
    .filter(isVisibleText)
    .map((literal) => literal.text.trim());

test('STRINGS is frozen at every level', () => {
  assert.throws(() => {
    STRINGS.nuevo = {};
  }, TypeError);
  for (const [group, values] of Object.entries(STRINGS)) {
    const [firstKey] = Object.keys(values);
    assert.throws(
      () => {
        values[firstKey] = 'cambiado';
      },
      TypeError,
      group,
    );
    assert.throws(
      () => {
        values.nueva = 'añadida';
      },
      TypeError,
      group,
    );
  }
});

test('STRINGS is grouped by view and every value is a non-empty string', () => {
  assert.deepEqual(Object.keys(STRINGS).sort(), [
    'bayas',
    'comun',
    'habilidades',
    'movimientos',
    'naturalezas',
    'objetos',
    'pokedex',
    'tipos',
  ]);
  for (const [group, values] of Object.entries(STRINGS)) {
    for (const [key, value] of Object.entries(values)) {
      assert.equal(typeof value, 'string', `${group}.${key}`);
      assert.notEqual(value, '', `${group}.${key}`);
    }
  }
});

test('the literal guard detects visible text', () => {
  assert.deepEqual(visibleLiterals('const a = `<span>HOLA</span>`;'), ['<span>HOLA</span>']);
  assert.deepEqual(visibleLiterals("stat('POW', 1);"), ['POW']);
  assert.deepEqual(visibleLiterals('const a = `<td>${x} m</td>`;'), ['<td> m</td>']);
  assert.deepEqual(visibleLiterals('const a = `<a aria-label="Cerrar">${x}</a>`;'), [
    '<a aria-label="Cerrar"></a>',
  ]);
  assert.deepEqual(visibleLiterals('const a = `<input placeholder="buscar">`;'), [
    '<input placeholder="buscar">',
  ]);
  assert.deepEqual(visibleLiterals('const a = `${x} H`;'), ['H']);
  assert.deepEqual(visibleLiterals('const a = `${`<b>${y} kg</b>`}`;'), ['<b> kg</b>']);
});

test('the literal guard ignores markup, symbols and code identifiers', () => {
  assert.deepEqual(visibleLiterals('const a = `<span class="x">${x}</span>`;'), []);
  assert.deepEqual(visibleLiterals("const a = 'type-badge';"), []);
  assert.deepEqual(visibleLiterals("const a = '—';"), []);
  assert.deepEqual(visibleLiterals('const a = `<img alt="${x}" src="${y}">`;'), []);
  assert.deepEqual(visibleLiterals("const a = `<td>×2 ½ ✕ ₽ #${x}</td>`; // Comentario 'X'"), []);
  assert.deepEqual(visibleLiterals("const a = { '2x': 'a\\'b' };"), []);
});

for (const file of GUARDED_FILES) {
  test(`${file} has no visible text literals`, () => {
    const source = readFileSync(join(UI_DIR, file), 'utf8');
    assert.deepEqual(visibleLiterals(source), [], `Literales visibles en ${file}`);
  });
}
