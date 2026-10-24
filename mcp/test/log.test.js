import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger } from '../src/log.js';

function logAll(level) {
  const lines = [];
  const log = createLogger({ level, write: (line) => lines.push(line) });
  log.error('e');
  log.info('i');
  log.debug('d');
  return lines;
}

const ERROR = '[pokedex-mcp] error: e\n';
const INFO = '[pokedex-mcp] info: i\n';
const DEBUG = '[pokedex-mcp] debug: d\n';

for (const [level, expected] of [
  [undefined, [ERROR]],
  ['', [ERROR]],
  ['verbose', [ERROR]],
  ['error', [ERROR]],
  ['info', [ERROR, INFO]],
  ['debug', [ERROR, INFO, DEBUG]],
]) {
  test(`level ${JSON.stringify(level)} writes ${expected.length} line(s)`, () => {
    assert.deepEqual(logAll(level), expected);
  });
}

test('formats one line with prefix, level and message', () => {
  const lines = [];
  createLogger({ level: 'info', write: (line) => lines.push(line) }).info(
    'servidor iniciado (v1.0.0)',
  );
  assert.deepEqual(lines, ['[pokedex-mcp] info: servidor iniciado (v1.0.0)\n']);
});
