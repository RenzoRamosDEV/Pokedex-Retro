import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SITE_DIR = join(import.meta.dirname, '../..');
const FONT_FILES = ['press-start-2p-latin-400-normal.woff2', 'vt323-latin-400-normal.woff2'];

const HTML_PAGES = readdirSync(SITE_DIR)
  .filter((file) => file.endsWith('.html'))
  .sort();
const readSite = (file) => readFileSync(join(SITE_DIR, file), 'utf8');
const tagsOf = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'))?.[1] ?? null;
const hasFlag = (tag, name) => new RegExp(`\\s${name}(?=[\\s/>=])`, 'i').test(tag);

for (const page of HTML_PAGES) {
  test(`${page} does not reference Google Fonts`, () => {
    assert.doesNotMatch(readSite(page), /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  test(`${page} preloads both self-hosted fonts with crossorigin`, () => {
    const preloads = tagsOf(readSite(page), 'link').filter(
      (tag) => attribute(tag, 'rel') === 'preload',
    );
    assert.equal(preloads.length, 2, page);
    FONT_FILES.forEach((font, index) => {
      const tag = preloads[index];
      assert.ok(attribute(tag, 'href').endsWith(`fonts/${font}`), tag);
      assert.equal(attribute(tag, 'as'), 'font', tag);
      assert.equal(attribute(tag, 'type'), 'font/woff2', tag);
      assert.ok(hasFlag(tag, 'crossorigin'), tag);
    });
  });
}

test('pokedex.css declares both fonts with font-display swap and existing files', () => {
  const css = readSite('css/pokedex.css');
  const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
  assert.deepEqual(
    faces.map((face) => face.match(/font-family:\s*'([^']+)'/)[1]),
    ['Press Start 2P', 'VT323'],
  );
  faces.forEach((face, index) => {
    assert.match(face, /font-display:\s*swap;/);
    const url = face.match(/url\('([^']+)'\)/)[1];
    assert.equal(url, `../fonts/${FONT_FILES[index]}`);
    assert.ok(existsSync(join(SITE_DIR, 'css', url)), url);
  });
});

test('site/fonts/OFL.txt carries the SIL OFL 1.1 for both families', () => {
  const license = readSite('fonts/OFL.txt');
  assert.match(license, /SIL Open Font License, Version 1\.1/);
  assert.match(license, /Press Start 2P/);
  assert.match(license, /VT323/);
});
