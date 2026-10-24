import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockPokeApi } from './pokeapi-mock.js';
import { mockAnthropic } from './anthropic-mock.js';
import { mensaje, textBlock, toolUseBlock } from '../support/claude-sse.js';

const CLAVE = 'sk-ant-e2e-falsa';
const STORAGE_KEY = 'pokedex:chat:apikey';
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const respuestaTexto = (texto) => ({
  eventos: mensaje({
    bloques: [textBlock(0, texto)],
    usage: { input_tokens: 100, cache_creation_input_tokens: 50 },
    salida: { output_tokens: 20 },
  }),
});
const respuestaEfectividad = () => ({
  eventos: mensaje({
    bloques: [
      toolUseBlock(0, {
        id: 'toolu_1',
        name: 'efectividad_tipos',
        input: { atacante: 'electric', defensor: ['water', 'flying'] },
      }),
    ],
    stopReason: 'tool_use',
    usage: { input_tokens: 100, cache_creation_input_tokens: 50 },
    salida: { output_tokens: 20 },
  }),
});

let pokeApi;

async function abrirChat(page, pasos = []) {
  pokeApi = await mockPokeApi(page);
  const anthropic = await mockAnthropic(page, pasos);
  await page.goto('chat.html');
  return anthropic;
}

async function guardarClave(page, clave = CLAVE, { recordar = false } = {}) {
  await page.getByLabel('CLAVE DE ANTHROPIC').fill(clave);
  if (recordar) await page.getByLabel('Recordar en este navegador').check();
  await page.getByLabel('CLAVE DE ANTHROPIC').press('Enter');
}

async function preguntar(page, texto) {
  await page.getByLabel('MENSAJE').fill(texto);
  await page.getByLabel('MENSAJE').press('Enter');
}

const estado = (page) => page.locator('main [role="status"]');
const registro = (page) => page.locator('main [role="log"]');

test.afterEach(() => {
  expect(pokeApi.external, 'peticiones externas sin simular').toEqual([]);
  expect(pokeApi.csp, 'violaciones de CSP').toEqual([]);
});

test('first visit shows the key form with its notice and calls nobody', async ({ page }) => {
  const anthropic = await abrirChat(page);
  await expect(page).toHaveTitle('CHAT — Pokédex Retro');
  await expect(page.getByLabel('CLAVE DE ANTHROPIC')).toBeVisible();
  await expect(page.getByText('Tu clave se queda en este navegador')).toBeVisible();
  await expect(page.getByLabel('MENSAJE')).toBeHidden();
  expect(anthropic.posts).toEqual([]);
});

test('a question runs a tool and shows the final text and the token line', async ({ page }) => {
  const anthropic = await abrirChat(page, [
    respuestaEfectividad(),
    respuestaTexto('Electric hace ×4.'),
  ]);
  let soltarTipos;
  const tiposRetenidos = new Promise((resolve) => {
    soltarTipos = resolve;
  });
  await page.route('https://pokeapi.co/api/v2/type?**', async (route) => {
    await tiposRetenidos;
    return route.fallback();
  });
  await guardarClave(page);
  await expect(page.getByLabel('MENSAJE')).toBeFocused();
  await preguntar(page, '¿Qué le hace electric a Gyarados?');
  await expect(estado(page)).toHaveText('CONSULTANDO: efectividad_tipos');
  soltarTipos();
  await expect(registro(page)).toContainText('Electric hace ×4.');
  await expect(registro(page)).toContainText('Tokens: 300 entrada · 40 salida');
  await expect(page.getByLabel('MENSAJE')).toBeFocused();
  expect(anthropic.posts).toHaveLength(2);
  const [primera, segunda] = anthropic.posts;
  expect(primera.headers['x-api-key']).toBe(CLAVE);
  expect(primera.headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
  expect(primera.body.model).toBe('claude-opus-5-5');
  const resultado = segunda.body.messages[2].content[0];
  expect(resultado.tool_use_id).toBe('toolu_1');
  expect(resultado.content).toContain('"multiplicador": 4');
  expect(await page.content()).not.toContain(CLAVE);
  expect(page.url()).not.toContain(CLAVE);
});

test('a key with the wrong format is rejected without a request', async ({ page }) => {
  const anthropic = await abrirChat(page);
  await guardarClave(page, 'abc123');
  await expect(estado(page)).toHaveText('La clave debe empezar por sk-ant-.');
  await expect(page.getByLabel('MENSAJE')).toBeHidden();
  expect(anthropic.posts).toEqual([]);
});

test('a 401 is shown once, without retrying', async ({ page }) => {
  const anthropic = await abrirChat(page, [
    { status: 401, type: 'authentication_error', message: 'invalid x-api-key' },
  ]);
  await guardarClave(page);
  await preguntar(page, 'hola');
  await expect(estado(page)).toHaveText('Clave no válida. Revísala en console.anthropic.com.');
  await expect(page.getByLabel('MENSAJE')).toBeFocused();
  expect(anthropic.posts).toHaveLength(1);
});

test('DETENER aborts a held request and lets the user ask again', async ({ page }) => {
  const anthropic = await abrirChat(page, [{ retener: true }, respuestaTexto('De nuevo.')]);
  await guardarClave(page);
  await preguntar(page, 'hola');
  await expect(page.getByRole('button', { name: 'ENVIAR' })).toBeDisabled();
  await page.getByRole('button', { name: 'DETENER' }).click();
  await expect(page.getByRole('button', { name: 'ENVIAR' })).toBeEnabled();
  anthropic.soltar();
  await preguntar(page, 'otra vez');
  await expect(registro(page)).toContainText('De nuevo.');
  expect(anthropic.posts).toHaveLength(2);
  expect(anthropic.posts[1].body.messages).toEqual([{ role: 'user', content: 'otra vez' }]);
});

test('without «Recordar» the key lives only in sessionStorage', async ({ page }) => {
  await abrirChat(page);
  await guardarClave(page);
  await expect(page.getByLabel('MENSAJE')).toBeVisible();
  const stored = await page.evaluate(
    (key) => [sessionStorage.getItem(key), localStorage.getItem(key)],
    STORAGE_KEY,
  );
  expect(stored).toEqual([CLAVE, null]);
  await expect(page.getByLabel('CLAVE DE ANTHROPIC')).toBeHidden();
});

test('OLVIDAR CLAVE forgets a remembered key and shows the key form again', async ({ page }) => {
  await abrirChat(page, [respuestaTexto('Hola.')]);
  await guardarClave(page, CLAVE, { recordar: true });
  await preguntar(page, 'hola');
  await expect(registro(page)).toContainText('Hola.');
  await page.getByRole('button', { name: 'OLVIDAR CLAVE' }).click();
  const stored = await page.evaluate(
    (key) => [sessionStorage.getItem(key), localStorage.getItem(key)],
    STORAGE_KEY,
  );
  expect(stored).toEqual([null, null]);
  await expect(page.getByLabel('CLAVE DE ANTHROPIC')).toBeVisible();
  await expect(registro(page)).toBeHidden();
  expect(await registro(page).textContent()).toBe('');
});

test('Shift+Enter keeps a line break and Enter sends once', async ({ page }) => {
  const anthropic = await abrirChat(page, [respuestaTexto('Vale.')]);
  await guardarClave(page);
  await page.getByLabel('MENSAJE').pressSequentially('a');
  await page.getByLabel('MENSAJE').press('Shift+Enter');
  await page.getByLabel('MENSAJE').pressSequentially('b');
  await page.getByLabel('MENSAJE').press('Enter');
  await expect(registro(page)).toContainText('Vale.');
  expect(anthropic.posts).toHaveLength(1);
  expect(anthropic.posts[0].body.messages).toEqual([{ role: 'user', content: 'a\nb' }]);
});

test('changing to Haiku 5.5 starts a new conversation without the fallback beta', async ({
  page,
}) => {
  const anthropic = await abrirChat(page, [respuestaTexto('Uno.'), respuestaTexto('Dos.')]);
  await guardarClave(page);
  await preguntar(page, 'primera');
  await expect(registro(page)).toContainText('Uno.');
  await page.getByLabel('MODELO').selectOption('claude-haiku-5-5');
  await expect(registro(page)).toHaveText('');
  await preguntar(page, 'segunda');
  await expect(registro(page)).toContainText('Dos.');
  const segunda = anthropic.posts[1];
  expect(segunda.body.model).toBe('claude-haiku-5-5');
  expect(segunda.body.messages).toEqual([{ role: 'user', content: 'segunda' }]);
  expect(segunda.headers['anthropic-beta']).toBeUndefined();
  expect(segunda.body.fallbacks).toBeUndefined();
});

test('NUEVA CONVERSACIÓN empties the log and the next request has only the new question', async ({
  page,
}) => {
  const anthropic = await abrirChat(page, [respuestaTexto('Uno.'), respuestaTexto('Dos.')]);
  await guardarClave(page);
  await preguntar(page, 'primera');
  await expect(registro(page)).toContainText('Uno.');
  await page.getByRole('button', { name: 'NUEVA CONVERSACIÓN' }).click();
  await expect(registro(page)).toHaveText('');
  await preguntar(page, 'segunda');
  await expect(registro(page)).toContainText('Dos.');
  expect(anthropic.posts[1].body.messages).toEqual([{ role: 'user', content: 'segunda' }]);
});

for (const theme of ['normal', 'gb', 'gray']) {
  test(`axe: chat.html [${theme}] before and after a conversation with an answer and an error`, async ({
    page,
  }) => {
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    await abrirChat(page, [
      respuestaTexto('Pikachu es de tipo electric.'),
      { status: 529, type: 'overloaded_error', message: 'Overloaded' },
      { status: 529, type: 'overloaded_error', message: 'Overloaded' },
      { status: 529, type: 'overloaded_error', message: 'Overloaded' },
    ]);
    await expectNoSeriousViolations(page, `chat.html [${theme}] clave`);
    await guardarClave(page);
    await preguntar(page, 'hola');
    await expect(registro(page)).toContainText('Pikachu es de tipo electric.');
    await preguntar(page, 'otra');
    await expect(estado(page)).toHaveText('Claude está saturado. Inténtalo en unos minutos.', {
      timeout: 10_000,
    });
    await expectNoSeriousViolations(page, `chat.html [${theme}] conversación`);
  });
}

async function expectNoSeriousViolations(page, label) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking = violations
    .filter((violation) => ['serious', 'critical'].includes(violation.impact))
    .map((v) => `${label}: ${v.id} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(blocking, blocking.join('\n')).toEqual([]);
}
