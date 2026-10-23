import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractHeader, findHeaderMismatches } from './check-html.mjs';

const ROOT = join(import.meta.dirname, '..');
const SCRIPT = join(ROOT, 'scripts', 'check-html.mjs');
const FILES = [
  'index.html',
  'movimientos.html',
  'tipos.html',
  'habilidades.html',
  'naturalezas.html',
  'objetos.html',
  'bayas.html',
];

function navLink(href, activeFile) {
  return href === activeFile
    ? `<a href="${href}" class="nav-link active" aria-current="page">X</a>`
    : `<a href="${href}" class="nav-link">X</a>`;
}

function page({ activeFile, links = FILES, header = true }) {
  const nav = links.map((href) => navLink(href, activeFile)).join('\n');
  const body = header ? `<header class="site-header"><nav>\n${nav}\n</nav></header>` : '';
  return `<!doctype html><html><head><title>${activeFile}</title></head><body>${body}<main></main></body></html>`;
}

const site = (overrides = {}) =>
  FILES.map((file) => ({ file, html: overrides[file] ?? page({ activeFile: file }) }));

test('extractHeader returns the first header block', () => {
  const html = '<body><header id="a">uno</header><header>dos</header></body>';
  assert.equal(extractHeader(html), '<header id="a">uno</header>');
});

test('extractHeader returns null without a header', () => {
  assert.equal(extractHeader('<body><main></main></body>'), null);
});

test('pages that only differ in their own active mark match', () => {
  assert.deepEqual(findHeaderMismatches(site()), []);
});

test('a different navigation link is reported', () => {
  const links = FILES.map((file) => (file === 'objetos.html' ? 'otros.html' : file));
  const pages = site({ 'tipos.html': page({ activeFile: 'tipos.html', links }) });
  assert.deepEqual(findHeaderMismatches(pages), ['tipos.html']);
});

test('an active mark on another page link is reported', () => {
  const pages = site({ 'bayas.html': page({ activeFile: 'tipos.html' }) });
  assert.deepEqual(findHeaderMismatches(pages), ['bayas.html']);
});

test('a missing active mark is reported', () => {
  const pages = site({ 'objetos.html': page({ activeFile: null }) });
  assert.deepEqual(findHeaderMismatches(pages), ['objetos.html']);
});

test('an active class without aria-current is reported', () => {
  const html = page({ activeFile: 'tipos.html' }).replace(' aria-current="page"', '');
  assert.deepEqual(findHeaderMismatches(site({ 'tipos.html': html })), ['tipos.html']);
});

test('a page without header is reported', () => {
  const pages = site({
    'habilidades.html': page({ activeFile: 'habilidades.html', header: false }),
  });
  assert.deepEqual(findHeaderMismatches(pages), ['habilidades.html']);
});

test('a divergent index.html makes every other page differ', () => {
  const links = [...FILES, 'extra.html'];
  const pages = site({ 'index.html': page({ activeFile: 'index.html', links }) });
  assert.deepEqual(findHeaderMismatches(pages), FILES.slice(1));
});

test('the reference is index.html whatever its position', () => {
  const links = [...FILES, 'extra.html'];
  const pages = site({ 'index.html': page({ activeFile: 'index.html', links }) }).reverse();
  assert.deepEqual(findHeaderMismatches(pages), FILES.slice(1).reverse());
});

test('without a header in index.html every page is reported', () => {
  const pages = site({
    'index.html': page({ activeFile: 'index.html', header: false }),
    'tipos.html': page({ activeFile: 'tipos.html', header: false }),
  });
  assert.deepEqual(findHeaderMismatches(pages), FILES);
});

function runCli(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' });
}

test('the CLI exits 1 and names each divergent page in order', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'check-html-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const file of FILES) cpSync(join(ROOT, 'site', file), join(dir, file));
  writeFileSync(join(dir, 'notas.txt'), 'sin cabecera');
  for (const file of ['tipos.html', 'movimientos.html']) {
    const path = join(dir, file);
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace('href="bayas.html"', 'href="bayas-otra.html"'),
    );
  }
  const result = runCli([dir]);
  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'Cabecera distinta en: movimientos.html\nCabecera distinta en: tipos.html\n',
  );
});

test('the CLI exits 0 on the real site', () => {
  const result = runCli([]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /7/);
});

test('importing the module does not run the CLI', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'check-html-import-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const importer = join(dir, 'importer.mjs');
  writeFileSync(importer, `await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});\n`);
  const result = spawnSync(process.execPath, [importer], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('evaluating an import without a script path does not run the CLI', () => {
  const code = `await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});
