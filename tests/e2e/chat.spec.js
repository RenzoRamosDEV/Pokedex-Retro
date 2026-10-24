import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockPokeApi } from './pokeapi-mock.js';
import { mockAnthropic } from './anthropic-mock.js';
import { mockOpenai } from './openai-mock.js';
import { mensaje, textBlock, toolUseBlock } from '../support/claude-sse.js';
import * as oa from '../support/openai-sse.js';

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
  await expect(
    page.getByText('Tu clave de Anthropic u OpenAI se queda en este navegador'),
  ).toBeVisible();
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
  await page.getByRole('combobox', { name: 'MODELO' }).selectOption('claude-haiku-5-5');
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

const CLAVE_OPENAI = 'sk-proj-e2e-falsa';
const STORAGE_KEY_OPENAI = 'pokedex:chat:apikey:openai';

const oaRespuestaTexto = (texto) => ({
  eventos: oa.respuesta({
    items: [oa.messageItem({ texto })],
    final: oa.responseCompleted(oa.usage({ entrada: 200, cache: 150, salida: 30 })),
  }),
});
const oaRespuestaEfectividad = () => ({
  eventos: oa.respuesta({
    items: [
      oa.reasoningItem({ cifrado: 'gAAAA-e2e' }),
      oa.functionCallItem({
        callId: 'call_1',
        name: 'efectividad_tipos',
        args: { atacante: 'electric', defensor: ['water', 'flying'] },
      }),
    ],
    final: oa.responseCompleted(oa.usage({ entrada: 100, cache: 40, salida: 20 })),
  }),
});

async function abrirChatAmbos(page, { openai = [], anthropic = [] } = {}) {
  pokeApi = await mockPokeApi(page);
  const mocks = {
    anthropic: await mockAnthropic(page, anthropic),
    openai: await mockOpenai(page, openai),
  };
  await page.goto('chat.html');
  return mocks;
}

const elegirProveedor = (page, nombre) =>
  page.getByLabel('PROVEEDOR').selectOption({ label: nombre });

async function guardarClaveOpenai(page, clave = CLAVE_OPENAI, { recordar = false } = {}) {
  await page.getByLabel('CLAVE DE OPENAI').fill(clave);
  if (recordar) await page.getByLabel('Recordar en este navegador').check();
  await page.getByLabel('CLAVE DE OPENAI').press('Enter');
}

const almacenado = (page, key) =>
  page.evaluate((k) => [sessionStorage.getItem(k), localStorage.getItem(k)], key);

test('the page starts with Claude and only its models', async ({ page }) => {
  await abrirChatAmbos(page);
  await expect(page.getByLabel('PROVEEDOR')).toHaveValue('anthropic');
  await expect(page.locator('#chat-modelo-openai')).toBeHidden();
});

test('changing to OpenAI empties the conversation and asks for the OpenAI key', async ({
  page,
}) => {
  const { openai } = await abrirChatAmbos(page, { anthropic: [respuestaTexto('Hola.')] });
  await guardarClave(page);
  await preguntar(page, 'hola');
  await expect(registro(page)).toContainText('Hola.');
  await elegirProveedor(page, 'OpenAI');
  await expect(registro(page)).toHaveText('');
  await expect(page.getByLabel('CLAVE DE OPENAI')).toBeVisible();
  await expect(page.getByLabel('MENSAJE')).toBeHidden();
  expect(openai.posts).toEqual([]);
});

test('a key of the other provider is rejected with its hint and not saved', async ({ page }) => {
  const { openai, anthropic } = await abrirChatAmbos(page);
  await guardarClave(page, 'sk-proj-xyz');
  await expect(estado(page)).toHaveText('Esa clave parece de OpenAI. Elige OpenAI en PROVEEDOR.');
  await elegirProveedor(page, 'OpenAI');
  await guardarClaveOpenai(page, 'sk-ant-xyz');
  await expect(estado(page)).toHaveText(
    'Esa clave es de Anthropic. Elige Claude (Anthropic) en PROVEEDOR.',
  );
  await guardarClaveOpenai(page, 'abc123');
  await expect(estado(page)).toHaveText('La clave de OpenAI debe empezar por sk-.');
  expect(await almacenado(page, STORAGE_KEY)).toEqual([null, null]);
  expect(await almacenado(page, STORAGE_KEY_OPENAI)).toEqual([null, null]);
  expect([...openai.posts, ...anthropic.posts]).toEqual([]);
});

test('OpenAI runs a tool and shows the final text labelled OPENAI and the tokens', async ({
  page,
}) => {
  const { openai, anthropic } = await abrirChatAmbos(page, {
    openai: [oaRespuestaEfectividad(), oaRespuestaTexto('Electric hace ×4.')],
  });
  let soltarTipos;
  const tiposRetenidos = new Promise((resolve) => {
    soltarTipos = resolve;
  });
  await page.route('https://pokeapi.co/api/v2/type?**', async (route) => {
    await tiposRetenidos;
    return route.fallback();
  });
  await elegirProveedor(page, 'OpenAI');
  await guardarClaveOpenai(page);
  await expect(page.getByLabel('MENSAJE')).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'MODELO' })).toHaveValue('gpt-6.1-sol');
  await preguntar(page, '¿Qué le hace electric a Gyarados?');
  await expect(estado(page)).toHaveText('CONSULTANDO: efectividad_tipos');
  soltarTipos();
  await expect(registro(page)).toContainText('OPENAI');
  await expect(registro(page)).toContainText('Electric hace ×4.');
  await expect(registro(page)).toContainText('Tokens: 300 entrada · 50 salida');
  expect(openai.posts).toHaveLength(2);
  expect(anthropic.posts).toEqual([]);
  const [primera, segunda] = openai.posts;
  expect(primera.headers.authorization).toBe(`Bearer ${CLAVE_OPENAI}`);
  expect(primera.body.model).toBe('gpt-6.1-sol');
  expect(primera.body.store).toBe(false);
  const salida = segunda.body.input.find((item) => item.type === 'function_call_output');
  expect(salida.call_id).toBe('call_1');
  expect(salida.output).toContain('"multiplicador": 4');
  expect(await page.content()).not.toContain(CLAVE_OPENAI);
});

test('an OpenAI 401 is shown once, without retrying', async ({ page }) => {
  const { openai } = await abrirChatAmbos(page, {
    openai: [{ status: 401, error: { code: 'invalid_api_key', message: 'Incorrect API key' } }],
  });
  await elegirProveedor(page, 'OpenAI');
  await guardarClaveOpenai(page);
  await preguntar(page, 'hola');
  await expect(estado(page)).toHaveText(
    'Clave de OpenAI no válida. Revísala en platform.openai.com.',
  );
  expect(openai.posts).toHaveLength(1);
});

test('an OpenAI quota 429 is shown once, without retrying', async ({ page }) => {
  const { openai } = await abrirChatAmbos(page, {
    openai: [
      {
        status: 429,
        error: { type: 'insufficient_quota', code: 'insufficient_quota', message: 'quota' },
      },
    ],
  });
  await elegirProveedor(page, 'OpenAI');
  await guardarClaveOpenai(page);
  await preguntar(page, 'hola');
  await expect(estado(page)).toHaveText('Tu cuenta de OpenAI no tiene saldo.');
  expect(openai.posts).toHaveLength(1);
});

test('each key is stored and sent only to its own provider', async ({ page }) => {
  const peticiones = [];
  page.on('request', (request) => peticiones.push(request));
  const { openai, anthropic } = await abrirChatAmbos(page, {
    anthropic: [respuestaEfectividad(), respuestaTexto('Claude.')],
    openai: [oaRespuestaEfectividad(), oaRespuestaTexto('OpenAI.')],
  });
  await guardarClave(page);
  await preguntar(page, 'uno');
  await expect(registro(page)).toContainText('Claude.');
  await elegirProveedor(page, 'OpenAI');
  await guardarClaveOpenai(page);
  await preguntar(page, 'dos');
  await expect(registro(page)).toContainText('OpenAI.');
  expect(await almacenado(page, STORAGE_KEY)).toEqual([CLAVE, null]);
  expect(await almacenado(page, STORAGE_KEY_OPENAI)).toEqual([CLAVE_OPENAI, null]);
  for (const post of anthropic.posts) {
    expect(post.headers['x-api-key']).toBe(CLAVE);
    expect(post.headers.authorization).toBeUndefined();
  }
  for (const post of openai.posts) {
    expect(post.headers.authorization).toBe(`Bearer ${CLAVE_OPENAI}`);
    expect(post.headers['x-api-key']).toBeUndefined();
  }
  const aPokeApi = peticiones.filter((r) => r.url().startsWith('https://pokeapi.co/'));
  expect(aPokeApi.length).toBeGreaterThan(0);
  for (const request of aPokeApi) {
    const headers = await request.allHeaders();
    expect(headers['x-api-key']).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(JSON.stringify(headers)).not.toMatch(/sk-(ant|proj)-e2e/);
  }
  const html = await page.content();
  expect(html).not.toContain(CLAVE);
  expect(html).not.toContain(CLAVE_OPENAI);
  expect(page.url()).not.toMatch(/sk-/);
});

test('OLVIDAR CLAVE with OpenAI keeps the Anthropic key', async ({ page }) => {
  await abrirChatAmbos(page);
  await guardarClave(page, CLAVE, { recordar: true });
  await elegirProveedor(page, 'OpenAI');
  await guardarClaveOpenai(page, CLAVE_OPENAI, { recordar: true });
  await page.getByRole('button', { name: 'OLVIDAR CLAVE' }).click();
  expect(await almacenado(page, STORAGE_KEY_OPENAI)).toEqual([null, null]);
  expect(await almacenado(page, STORAGE_KEY)).toEqual([null, CLAVE]);
  await expect(page.getByLabel('CLAVE DE OPENAI')).toBeVisible();
});

test('a key remembered by 1.2.0 is used without asking again', async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    [STORAGE_KEY, CLAVE],
  );
  const { anthropic } = await abrirChatAmbos(page, { anthropic: [respuestaTexto('Sigo.')] });
  await expect(page.getByLabel('MENSAJE')).toBeVisible();
  await preguntar(page, 'hola');
  await expect(registro(page)).toContainText('Sigo.');
  expect(anthropic.posts[0].headers['x-api-key']).toBe(CLAVE);
});

test('going back to Claude with both keys asks for none and calls Anthropic', async ({ page }) => {
  const { anthropic, openai } = await abrirChatAmbos(page, {
    openai: [oaRespuestaTexto('OpenAI.')],
    anthropic: [respuestaTexto('Claude.')],
  });
  await guardarClave(page);
  await elegirProveedor(page, 'OpenAI');
  await guardarClaveOpenai(page);
  await preguntar(page, 'uno');
  await expect(registro(page)).toContainText('OpenAI.');
  await elegirProveedor(page, 'Claude (Anthropic)');
  await expect(registro(page)).toHaveText('');
  await expect(page.getByLabel('MENSAJE')).toBeVisible();
  await expect(page.locator('#chat-modelo')).toBeVisible();
  await expect(page.locator('#chat-modelo-openai')).toBeHidden();
  await preguntar(page, 'dos');
  await expect(registro(page)).toContainText('Claude.');
  expect(openai.posts).toHaveLength(1);
  expect(anthropic.posts).toHaveLength(1);
  expect(anthropic.posts[0].body.messages).toEqual([{ role: 'user', content: 'dos' }]);
});

test('the provider selector is disabled while a reply is held', async ({ page }) => {
  const { openai } = await abrirChatAmbos(page, { openai: [{ retener: true }] });
  await elegirProveedor(page, 'OpenAI');
  await guardarClaveOpenai(page);
  await preguntar(page, 'hola');
  await expect(page.getByLabel('PROVEEDOR')).toBeDisabled();
  await page.getByRole('button', { name: 'DETENER' }).click();
  await expect(page.getByLabel('PROVEEDOR')).toBeEnabled();
  openai.soltar();
});

test('changing the OpenAI model starts a new conversation', async ({ page }) => {
  const { openai } = await abrirChatAmbos(page, {
    openai: [oaRespuestaTexto('Uno.'), oaRespuestaTexto('Dos.')],
  });
  await elegirProveedor(page, 'OpenAI');
  await guardarClaveOpenai(page);
  await preguntar(page, 'primera');
  await expect(registro(page)).toContainText('Uno.');
  await page.locator('#chat-modelo-openai').selectOption('gpt-6-luna');
  await expect(registro(page)).toHaveText('');
  await preguntar(page, 'segunda');
  await expect(registro(page)).toContainText('Dos.');
  expect(openai.posts[1].body.model).toBe('gpt-6-luna');
  expect(openai.posts[1].body.input).toEqual([{ role: 'user', content: 'segunda' }]);
});

for (const theme of ['normal', 'gb', 'gray']) {
  test(`axe: chat.html with OpenAI [${theme}] before and after an answer and an error`, async ({
    page,
  }) => {
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    await abrirChatAmbos(page, {
      openai: [
        oaRespuestaTexto('Pikachu es de tipo electric.'),
        { status: 401, error: { code: 'invalid_api_key', message: 'Incorrect API key' } },
      ],
    });
    await elegirProveedor(page, 'OpenAI');
    await expectNoSeriousViolations(page, `chat.html OpenAI [${theme}] clave`);
    await guardarClaveOpenai(page);
    await preguntar(page, 'hola');
    await expect(registro(page)).toContainText('Pikachu es de tipo electric.');
    await preguntar(page, 'otra');
    await expect(estado(page)).toHaveText(
      'Clave de OpenAI no válida. Revísala en platform.openai.com.',
    );
    await expectNoSeriousViolations(page, `chat.html OpenAI [${theme}] conversación`);
  });
}

async function expectNoSeriousViolations(page, label) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking = violations
    .filter((violation) => ['serious', 'critical'].includes(violation.impact))
    .map((v) => `${label}: ${v.id} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(blocking, blocking.join('\n')).toEqual([]);
}
