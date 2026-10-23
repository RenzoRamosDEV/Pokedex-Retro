import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SITE_DIR = join(import.meta.dirname, '..');
const BASE_URL = 'https://renzoramosdev.github.io/Pokedex-Retro/';
const BASE_PATH = '/Pokedex-Retro/';

const readSite = (file) => readFileSync(join(SITE_DIR, file), 'utf8');
const HTML_PAGES = readdirSync(SITE_DIR)
  .filter((file) => file.endsWith('.html'))
  .sort();
const NAVIGATION_PAGES = HTML_PAGES.filter((file) => file !== '404.html');

function pngSize(file) {
  const bytes = readFileSync(join(SITE_DIR, file));
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

test('404.html shows ERROR 404 and links back to the home page', () => {
  const html = readSite('404.html');
  assert.match(html, /ERROR 404/);
  assert.match(html, /href="\/Pokedex-Retro\/index\.html"/);
});

test('every href and src of 404.html is an absolute /Pokedex-Retro/ path', () => {
  const references = [...readSite('404.html').matchAll(/\s(?:href|src)="([^"]*)"/g)].map(
    (match) => match[1],
  );
  assert.ok(references.length > 0);
  assert.deepEqual(
    references.filter((reference) => !reference.startsWith(BASE_PATH)),
    [],
  );
});

test('robots.txt allows everything and points to the sitemap', () => {
  const lines = readSite('robots.txt').split('\n');
  assert.ok(lines.includes('User-agent: *'));
  assert.ok(lines.includes('Allow: /'));
  assert.ok(lines.includes(`Sitemap: ${BASE_URL}sitemap.xml`));
});

test('sitemap.xml lists exactly the 7 navigation pages under the site base', () => {
  const xml = readSite('sitemap.xml');
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locations = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
  assert.equal(NAVIGATION_PAGES.length, 7);
  assert.deepEqual(
    locations.sort(),
    NAVIGATION_PAGES.map((page) => BASE_URL + page),
  );
});

test('manifest.webmanifest has exactly the declared fields', () => {
  const manifest = JSON.parse(readSite('manifest.webmanifest'));
  assert.deepEqual(manifest, {
    name: 'Pokédex Retro',
    short_name: 'Pokédex',
    lang: 'es',
    start_url: './',
    display: 'standalone',
    theme_color: '#cc2200',
    icons: [
      { src: 'images/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'images/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
});

test('every manifest icon exists with the declared PNG size', () => {
  for (const icon of JSON.parse(readSite('manifest.webmanifest')).icons) {
    assert.ok(existsSync(join(SITE_DIR, icon.src)), icon.src);
    assert.equal(pngSize(icon.src), icon.sizes, icon.src);
  }
});

for (const page of HTML_PAGES) {
  test(`${page} links the web manifest`, () => {
    const expected =
      page === '404.html' ? `${BASE_PATH}manifest.webmanifest` : 'manifest.webmanifest';
    assert.match(readSite(page), new RegExp(`<link rel="manifest" href="${expected}" />`));
  });
}
