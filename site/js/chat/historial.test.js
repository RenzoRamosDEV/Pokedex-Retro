import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { bloquesParaHistorial } from './historial.js';

const thinking = (signature) => ({ type: 'thinking', thinking: '', signature });
const redacted = { type: 'redacted_thinking', data: 'abc' };
const text = (t) => ({ type: 'text', text: t });
const toolUse = (id) => ({ type: 'tool_use', id, name: 'naturalezas', input: {} });
const fallback = (to) => ({
  type: 'fallback',
  from: { model: 'claude-opus-5-5' },
  to: { model: to },
});

describe('bloquesParaHistorial', () => {
  test('keeps a turn without fallback identical and in order', () => {
    const content = [thinking('s1'), text('Hola'), toolUse('t1'), toolUse('t2')];
    assert.deepEqual(bloquesParaHistorial(content), content);
  });

  test('keeps a turn whose first block is a fallback', () => {
    const content = [fallback('claude-opus-5'), thinking('s1'), toolUse('t1')];
    assert.deepEqual(bloquesParaHistorial(content), content);
  });

  test('drops the thinking, redacted thinking and tool use before a mid-turn fallback', () => {
    const content = [
      thinking('s1'),
      redacted,
      text('Hola'),
      toolUse('t0'),
      fallback('claude-opus-5'),
      thinking('s2'),
      toolUse('t1'),
    ];
    assert.deepEqual(bloquesParaHistorial(content), [
      text('Hola'),
      fallback('claude-opus-5'),
      thinking('s2'),
      toolUse('t1'),
    ]);
  });

  test('cuts at the last of two fallbacks', () => {
    const content = [
      thinking('s1'),
      fallback('claude-opus-5'),
      thinking('s2'),
      text('a'),
      fallback('claude-opus-4-8'),
      toolUse('t1'),
    ];
    assert.deepEqual(bloquesParaHistorial(content), [
      fallback('claude-opus-5'),
      text('a'),
      fallback('claude-opus-4-8'),
      toolUse('t1'),
    ]);
  });

  test('sends a tool use with an invalid input as an empty object', () => {
    const content = [{ ...toolUse('t1'), input: {}, entrada_invalida: '{"a' }];
    assert.deepEqual(bloquesParaHistorial(content), [toolUse('t1')]);
  });

  test('does not mutate the given content', () => {
    const content = [thinking('s1'), fallback('x'), { ...toolUse('t1'), entrada_invalida: '{' }];
    const copia = structuredClone(content);
    bloquesParaHistorial(content);
    assert.deepEqual(content, copia);
  });
});
