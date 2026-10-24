import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE_DIR = join(import.meta.dirname, '..');
const SECTION_PAGES = [
  'index.html',
  'movimientos.html',
  'tipos.html',
  'habilidades.html',
  'naturalezas.html',
  'objetos.html',
  'bayas.html',
  'chat.html',
];

const readSite = (file) => readFileSync(join(SITE_DIR, file), 'utf8');
const tagsOf = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'))?.[1] ?? null;
const mainOf = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const plain = (text) => text.replace(/\s+/g, ' ').trim();
const navLinksOf = (html) =>
  [...html.matchAll(/<a href="([^"]*)" class="nav-link[^"]*"[^>]*>([^<]*)<\/a>/g)].map(
    ([, href, text]) => [href, text],
  );

for (const page of SECTION_PAGES) {
  const html = readSite(page);

  test(`${page}: the first child of body is the skip link to #contenido`, () => {
    assert.match(
      html,
      /<body\b[^>]*>\s*<a class="skip-link" href="#contenido">Saltar al contenido<\/a>/,
    );
  });

  test(`${page}: main is the focusable #contenido target`, () => {
    assert.deepEqual(tagsOf(html, 'main'), [
      '<main id="contenido" class="site-main" tabindex="-1">',
    ]);
  });

  test(`${page}: there is exactly one polite status region and it lives in main`, () => {
    const regions = tagsOf(html, '[a-z]+').filter((tag) => attribute(tag, 'role') === 'status');
    assert.equal(regions.length, 1);
    assert.equal(attribute(regions[0], 'aria-live'), 'polite');
    assert.ok(mainOf(html).includes(regions[0]));
  });

  for (const [button, panel] of [
    ['theme-btn', 'theme-dropdown'],
    ['info-btn', 'info-dropdown'],
  ]) {
    test(`${page}: #${button} announces and controls #${panel}`, () => {
      const tag = tagsOf(html, 'button').find((candidate) => attribute(candidate, 'id') === button);
      assert.ok(tag, button);
      assert.equal(attribute(tag, 'type'), 'button');
      assert.equal(attribute(tag, 'aria-haspopup'), 'true');
      assert.equal(attribute(tag, 'aria-expanded'), 'false');
      assert.equal(attribute(tag, 'aria-controls'), panel);
      assert.ok(html.includes(`id="${panel}"`), panel);
    });
  }

  test(`${page}: there is no hidden menu checkbox nor focusable element hidden from AT`, () => {
    assert.doesNotMatch(html, /id="nav-toggle"/);
    const focusable = ['a', 'button', 'input', 'select', 'textarea'].flatMap((name) =>
      tagsOf(html, name),
    );
    const hidden = [
      ...focusable,
      ...tagsOf(html, '[a-z]+').filter((tag) => /\stabindex=/.test(tag)),
    ].filter((tag) => attribute(tag, 'aria-hidden') === 'true');
    assert.deepEqual(hidden, []);
  });

  test(`${page}: the menu button controls the hidden navigation`, () => {
    const tag = tagsOf(html, 'button').find(
      (candidate) => attribute(candidate, 'id') === 'nav-btn',
    );
    assert.ok(tag, 'nav-btn');
    assert.equal(attribute(tag, 'type'), 'button');
    assert.equal(attribute(tag, 'class'), 'hamburger');
    assert.equal(attribute(tag, 'aria-label'), 'Abrir menú');
    assert.equal(attribute(tag, 'aria-expanded'), 'false');
    assert.equal(attribute(tag, 'aria-controls'), 'nav-menu');
    const nav = tagsOf(html, 'nav').find((candidate) => attribute(candidate, 'id') === 'nav-menu');
    assert.ok(nav, 'nav-menu');
    assert.equal(attribute(nav, 'class'), 'nav-menu');
    assert.equal(attribute(nav, 'aria-label'), 'Navegación principal');
    assert.match(nav, /\shidden(?=[\s>])/);
  });

  test(`${page}: the navigation ends with CHAT and the INFO panel counts 8 sections`, () => {
    const links = navLinksOf(html);
    assert.equal(links.length, 8);
    assert.deepEqual(links.at(-1), ['chat.html', 'CHAT']);
    assert.match(
      html,
      /<span class="info-label">SECCIONES<\/span>\s*<span class="info-value">8<\/span>/,
    );
  });

  test(`${page}: main has a noscript notice`, () => {
    assert.match(
      mainOf(html),
      /<noscript>\s*<p class="page-info">ESTA POKÉDEX NECESITA JAVASCRIPT<\/p>\s*<\/noscript>/,
    );
  });
}

test('pokedex.css disables transitions and animations under prefers-reduced-motion', () => {
  const css = readSite('css/pokedex.css');
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.notEqual(start, -1);
  const block = css.slice(start);
  assert.match(block, /transition:\s*none\s*!important/);
  assert.match(block, /animation:\s*none\s*!important/);
});

describe('chat.html', () => {
  const html = readSite('chat.html');
  const byId = (id) =>
    tagsOf(html, '[a-z]+').find((tag) => attribute(tag, 'id') === id) ?? assert.fail(id);
  const labelFor = (id) =>
    html.match(new RegExp(`<label\\b[^>]*\\sfor="${id}"[^>]*>([\\s\\S]*?)</label>`))?.[1].trim();
  const selectOf = (id) =>
    html.match(new RegExp(`<select\\b[^>]*\\sid="${id}"[^>]*>[\\s\\S]*?</select>`))?.[0] ??
    assert.fail(id);
  const optionsOf = (id) =>
    [...selectOf(id).matchAll(/<option value="([^"]*)"( selected)?>([^<]*)<\/option>/g)].map(
      ([, value, selected, text]) => [value, Boolean(selected), plain(text)],
    );
  /** The element whose opening tag is `tag`, up to its matching closing tag of the same name. */
  const blockOf = (pattern, name) =>
    html.match(new RegExp(`${pattern}[\\s\\S]*?</${name}>`))?.[0] ?? assert.fail(pattern);

  test('the message area is a polite log', () => {
    const logs = tagsOf(html, '[a-z]+').filter((tag) => attribute(tag, 'role') === 'log');
    assert.equal(logs.length, 1);
    assert.equal(attribute(logs[0], 'aria-live'), 'polite');
    assert.ok(mainOf(html).includes(logs[0]));
  });

  for (const id of [
    'chat-proveedor',
    'chat-clave',
    'chat-recordar',
    'chat-modelo',
    'chat-modelo-openai',
    'chat-mensaje',
  ]) {
    test(`#${id} has an associated label with text`, () => {
      byId(id);
      assert.ok(labelFor(id), id);
    });
  }

  test('the key field is a password without autocomplete', () => {
    const input = byId('chat-clave');
    assert.equal(attribute(input, 'type'), 'password');
    assert.equal(attribute(input, 'autocomplete'), 'off');
  });

  test('remembering the key is an unchecked checkbox labelled «Recordar en este navegador»', () => {
    const checkbox = byId('chat-recordar');
    assert.equal(attribute(checkbox, 'type'), 'checkbox');
    assert.doesNotMatch(checkbox, /\schecked/);
    assert.equal(plain(labelFor('chat-recordar')), 'Recordar en este navegador');
  });

  test('the model selector offers the three models with their prices, Opus 5.5 selected', () => {
    assert.deepEqual(optionsOf('chat-modelo'), [
      ['claude-opus-5-5', true, 'Claude Opus 5.5 — $4 / $20 por millón de tokens'],
      ['claude-sonnet-5-5', false, 'Claude Sonnet 5.5 — $2 / $10'],
      ['claude-haiku-5-5', false, 'Claude Haiku 5.5 — $0,10 / $0,50'],
    ]);
  });

  test('shows the privacy and cost notice next to the key form', () => {
    assert.match(
      plain(html),
      /Tu clave de Anthropic u OpenAI se queda en este navegador y solo se envía a la API de su proveedor \(api\.anthropic\.com o api\.openai\.com\)\. Las conversaciones se cobran en tu cuenta de ese proveedor\. Delegar en subagentes consume tokens adicionales\./,
    );
  });

  test('the title names both providers', () => {
    assert.match(mainOf(html), /<h2 class="page-title">CHAT CON CLAUDE U OPENAI<\/h2>/);
  });

  test('the provider selector is labelled PROVEEDOR and offers Claude (selected) and OpenAI', () => {
    assert.equal(plain(labelFor('chat-proveedor')), 'PROVEEDOR');
    assert.deepEqual(optionsOf('chat-proveedor'), [
      ['anthropic', true, 'Claude (Anthropic)'],
      ['openai', false, 'OpenAI'],
    ]);
  });

  test('the provider selector is outside the key form and the conversation', () => {
    const select = selectOf('chat-proveedor');
    assert.ok(mainOf(html).includes(select));
    assert.equal(blockOf('<form class="chat-panel chat-key"', 'form').includes(select), false);
    assert.equal(blockOf('<section class="chat-panel chat"', 'section').includes(select), false);
  });

  test('the OpenAI model selector is labelled MODELO, hidden, with GPT-6.1 Sol selected', () => {
    assert.equal(plain(labelFor('chat-modelo-openai')), 'MODELO');
    assert.deepEqual(optionsOf('chat-modelo-openai'), [
      ['gpt-6.1-sol', true, 'GPT-6.1 Sol (equilibrado) — $2 / $10 por millón de tokens'],
      ['gpt-6-astra', false, 'GPT-6 Astra (más capaz, más caro) — $10 / $50'],
      ['gpt-6-luna', false, 'GPT-6 Luna (más barato) — $0,10 / $0,50'],
    ]);
    const contenedor = blockOf('<div class="chat-modelos" data-modelos="openai" hidden>', 'div');
    assert.ok(contenedor.includes(selectOf('chat-modelo-openai')));
    const claude = blockOf('<div class="chat-modelos" data-modelos="anthropic">', 'div');
    assert.ok(claude.includes(selectOf('chat-modelo')));
  });

  test('offers ENVIAR, DETENER, NUEVA CONVERSACIÓN and OLVIDAR CLAVE', () => {
    const buttons = [...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map(([, text]) =>
      plain(text),
    );
    for (const name of ['ENVIAR', 'DETENER', 'NUEVA CONVERSACIÓN', 'OLVIDAR CLAVE']) {
      assert.ok(buttons.includes(name), name);
    }
  });

  test('marks only its own CHAT link as the current page', () => {
    const current = tagsOf(html, 'a').filter((tag) => attribute(tag, 'aria-current') === 'page');
    assert.deepEqual(current, ['<a href="chat.html" class="nav-link active" aria-current="page">']);
  });
});
