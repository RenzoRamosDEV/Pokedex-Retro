import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELOS,
  MODELO_POR_DEFECTO,
  MODELOS_OPENAI,
  MODELO_POR_DEFECTO_OPENAI,
} from './modelos.js';

test('offers Opus 5.5, Sonnet 5.5 and Haiku 5.5, with server-side fallback on the first two', () => {
  assert.deepEqual(MODELOS, [
    { id: 'claude-opus-5-5', fallback: true },
    { id: 'claude-sonnet-5-5', fallback: true },
    { id: 'claude-haiku-5-5', fallback: false },
  ]);
});

test('defaults to Opus 5.5', () => {
  assert.equal(MODELO_POR_DEFECTO, 'claude-opus-5-5');
});

test('offers GPT-6.1 Sol, GPT-6 Astra and GPT-6 Luna for OpenAI', () => {
  assert.deepEqual(MODELOS_OPENAI, [
    { id: 'gpt-6.1-sol' },
    { id: 'gpt-6-astra' },
    { id: 'gpt-6-luna' },
  ]);
});

test('defaults to GPT-6.1 Sol for OpenAI', () => {
  assert.equal(MODELO_POR_DEFECTO_OPENAI, 'gpt-6.1-sol');
});
