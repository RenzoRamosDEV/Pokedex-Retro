import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockPokeApi } from './pokeapi-mock.js';
import { mockAnthropic } from './anthropic-mock.js';
import { mockOpenai } from './openai-mock.js';
import { mensaje, textBlock, toolUseBlock } from '../support/claude-sse.js';
import * as oa from '../support/openai-sse.js';
import { SUBAGENTES } from '../../site/js/chat/agentes/subagentes.js';

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

async function abrirChatAmbos(page, { openai = [], anthropic = [], modelos = [] } = {}) {
  pokeApi = await mockPokeApi(page);
  const mocks = {
    anthropic: await mockAnthropic(page, anthropic),
    openai: await mockOpenai(page, openai, { modelos }),
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
  expect(openai.modelos).toEqual([]);
});

for (const [estadoModelos, mensajeEsperado] of [
  [401, 'Clave de OpenAI no válida. Revísala en platform.openai.com.'],
  [
    200,
    'OpenAI rechazó la petición. Revisa el saldo y los límites de tu cuenta en platform.openai.com.',
  ],
]) {
  test(`an OpenAI error without CORS headers is diagnosed with /v1/models ${estadoModelos}`, async ({
    page,
  }) => {
    const { openai } = await abrirChatAmbos(page, {
      openai: [{ sinCors: true }, oaRespuestaTexto('nunca')],
      modelos: [estadoModelos],
    });
    await elegirProveedor(page, 'OpenAI');
    await guardarClaveOpenai(page);
    await preguntar(page, 'hola');
    await expect(estado(page)).toHaveText(mensajeEsperado);
    expect(openai.posts).toHaveLength(1);
    expect(openai.modelos).toHaveLength(1);
    expect(openai.modelos[0].headers.authorization).toBe(`Bearer ${CLAVE_OPENAI}`);
    expect(await page.content()).not.toContain(CLAVE_OPENAI);
  });
}

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

const RESPUESTA_FIJA = 'Solo puedo responder preguntas sobre Pokémon.';
const ESTRATEGA = SUBAGENTES.find((s) => s.nombre === 'estratega-tipos');

const llamadaClaude = (name, input, uso) => ({
  eventos: mensaje({
    bloques: [toolUseBlock(0, { id: 'toolu_1', name, input })],
    stopReason: 'tool_use',
    usage: { input_tokens: uso.entrada },
    salida: { output_tokens: uso.salida },
  }),
});
const textoClaude = (texto, uso) => ({
  eventos: mensaje({
    bloques: [textBlock(0, texto)],
    usage: { input_tokens: uso.entrada },
    salida: { output_tokens: uso.salida },
  }),
});
const delegacion = () =>
  llamadaClaude(
    'delegar_subagente',
    { subagente: 'estratega-tipos', tarea: 'debilidades de gyarados' },
    { entrada: 100, salida: 20 },
  );

/** The status line changes before the held request reaches the mock, so wait for it first. */
async function soltarRetenida(mock, peticiones) {
  await expect.poll(() => mock.posts.length).toBe(peticiones);
  mock.soltar();
}

function contarPokeApi(page) {
  const urls = [];
  page.on('request', (request) => {
    if (request.url().startsWith('https://pokeapi.co/')) urls.push(request.url());
  });
  return urls;
}

test('the notice warns that delegating to subagents costs extra tokens', async ({ page }) => {
  await abrirChat(page);
  await expect(page.getByText('Delegar en subagentes consume tokens adicionales.')).toBeVisible();
});

test('a delegation shows SUBAGENTE, then only the main text and the summed tokens', async ({
  page,
}) => {
  const anthropic = await abrirChat(page, [
    delegacion(),
    {
      retener: true,
      ...textoClaude('Gyarados es débil a electric (x4) y rock.', { entrada: 50, salida: 10 }),
    },
    textoClaude('Evita los ataques electric.', { entrada: 200, salida: 30 }),
  ]);
  await guardarClave(page);
  await preguntar(page, '¿Qué debilidades tiene Gyarados?');
  await expect(estado(page)).toHaveText('SUBAGENTE: estratega-tipos');
  await soltarRetenida(anthropic, 2);
  await expect(registro(page)).toContainText('Evita los ataques electric.');
  await expect(registro(page)).toContainText('Tokens: 350 entrada · 60 salida');
  await expect(registro(page)).not.toContainText('Gyarados es débil a electric');
  expect(anthropic.posts).toHaveLength(3);
  const [, subagente, segunda] = anthropic.posts;
  expect(subagente.body.system).toBe(ESTRATEGA.sistema);
  expect(subagente.body.model).toBe(anthropic.posts[0].body.model);
  expect(subagente.headers['x-api-key']).toBe(CLAVE);
  expect(subagente.body.messages).toEqual([{ role: 'user', content: 'debilidades de gyarados' }]);
  expect(segunda.body.messages.at(-1).content[0].content).toBe(
    'Gyarados es débil a electric (x4) y rock.',
  );
});

test('DETENER aborts a held subagent request and no other request follows', async ({ page }) => {
  const anthropic = await abrirChat(page, [
    delegacion(),
    { retener: true },
    respuestaTexto('De nuevo.'),
  ]);
  await guardarClave(page);
  await preguntar(page, '¿Qué debilidades tiene Gyarados?');
  await expect(estado(page)).toHaveText('SUBAGENTE: estratega-tipos');
  await expect.poll(() => anthropic.posts.length).toBe(2);
  await page.getByRole('button', { name: 'DETENER' }).click();
  await expect(page.getByRole('button', { name: 'ENVIAR' })).toBeEnabled();
  anthropic.soltar();
  await preguntar(page, 'otra vez');
  await expect(registro(page)).toContainText('De nuevo.');
  expect(anthropic.posts).toHaveLength(3);
  expect(anthropic.posts[2].body.messages).toEqual([{ role: 'user', content: 'otra vez' }]);
});

test('loading a skill shows SKILL with its name', async ({ page }) => {
  const anthropic = await abrirChat(page, [
    llamadaClaude('usar_skill', { nombre: 'comparar-pokemon' }, { entrada: 10, salida: 5 }),
    { retener: true, ...textoClaude('Raichu gana en velocidad.', { entrada: 20, salida: 5 }) },
  ]);
  await guardarClave(page);
  await preguntar(page, 'Compara pikachu y raichu');
  await expect(estado(page)).toHaveText('SKILL: comparar-pokemon');
  await soltarRetenida(anthropic, 2);
  await expect(registro(page)).toContainText('Raichu gana en velocidad.');
  expect(anthropic.posts[1].body.messages.at(-1).content[0].content).toContain(
    'Compara los dos Pokémon que indique el usuario.',
  );
});

test('an off-topic question with Claude gets the fixed answer from one request', async ({
  page,
}) => {
  const anthropic = await abrirChat(page, [
    textoClaude(RESPUESTA_FIJA, { entrada: 30, salida: 8 }),
  ]);
  const pokeApiUrls = contarPokeApi(page);
  await guardarClave(page);
  await preguntar(page, '¿Cuál es la capital de Francia?');
  await expect(registro(page)).toContainText(RESPUESTA_FIJA);
  await expect(registro(page)).toContainText('Tokens: 30 entrada · 8 salida');
  expect(anthropic.posts).toHaveLength(1);
  expect(anthropic.posts[0].body.system).toContain(RESPUESTA_FIJA);
  expect(pokeApiUrls).toEqual([]);
});

test('an off-topic question with OpenAI gets the fixed answer from one request', async ({
  page,
}) => {
  const { openai, anthropic } = await abrirChatAmbos(page, {
    openai: [
      {
        eventos: oa.respuesta({
          items: [oa.messageItem({ texto: RESPUESTA_FIJA })],
          final: oa.responseCompleted(oa.usage({ entrada: 30, salida: 8 })),
        }),
      },
    ],
  });
  const pokeApiUrls = contarPokeApi(page);
  await elegirProveedor(page, 'OpenAI');
  await guardarClaveOpenai(page);
  await preguntar(page, '¿Cuál es la capital de Francia?');
  await expect(registro(page)).toContainText(RESPUESTA_FIJA);
  await expect(registro(page)).toContainText('Tokens: 30 entrada · 8 salida');
  expect(openai.posts).toHaveLength(1);
  expect(anthropic.posts).toEqual([]);
  expect(openai.posts[0].body.instructions).toContain(RESPUESTA_FIJA);
  expect(pokeApiUrls).toEqual([]);
});

for (const theme of ['normal', 'gb', 'gray']) {
  test(`axe: chat.html [${theme}] with a delegation in progress and answered`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    const anthropic = await abrirChat(page, [
      delegacion(),
      { retener: true, ...textoClaude('Débil a electric.', { entrada: 50, salida: 10 }) },
      textoClaude('Evita electric.', { entrada: 200, salida: 30 }),
    ]);
    await guardarClave(page);
    await preguntar(page, '¿Qué debilidades tiene Gyarados?');
    await expect(estado(page)).toHaveText('SUBAGENTE: estratega-tipos');
    await expectNoSeriousViolations(page, `chat.html [${theme}] subagente`);
    await soltarRetenida(anthropic, 2);
    await expect(registro(page)).toContainText('Evita electric.');
    await expectNoSeriousViolations(page, `chat.html [${theme}] delegación`);
  });
}
