import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { join } from 'node:path';
import { contentTypeFor, createSiteServer, resolveInside } from './serve-site.mjs';

const SITE = join(import.meta.dirname, '..', 'site');

for (const [file, type] of [
  ['index.html', 'text/html; charset=utf-8'],
  ['js/ui/main.js', 'text/javascript; charset=utf-8'],
  ['css/pokedex.css', 'text/css; charset=utf-8'],
  ['data.json', 'application/json; charset=utf-8'],
  ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['images/icon-192.png', 'image/png'],
  ['fonts/vt323.woff2', 'font/woff2'],
  ['robots.txt', 'text/plain; charset=utf-8'],
  ['sitemap.xml', 'application/xml; charset=utf-8'],
  ['archivo.desconocido', 'application/octet-stream'],
  ['sin-extension', 'application/octet-stream'],
]) {
  test(`contentTypeFor("${file}") is ${type}`, () => {
    assert.equal(contentTypeFor(file), type);
  });
}

for (const [url, expected] of [
  ['/', 'site/index.html'],
  ['/index.html', 'site/index.html'],
  ['/tipos.html?q=1', 'site/tipos.html'],
  ['/js/ui/main.js', 'site/js/ui/main.js'],
  ['/../package.json', null],
  ['/%2e%2e/package.json', null],
  ['/js/../../package.json', null],
  ['/%2E%2E%2Fpackage.json', null],
  ['/%E0%A4%A', null],
]) {
  test(`resolveInside("site", "${url}") is ${expected}`, () => {
    assert.equal(resolveInside('site', url), expected);
  });
}

function get(port, path) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () =>
        resolve({ status: res.statusCode, type: res.headers['content-type'], body }),
      );
    });
    req.on('error', reject);
    req.end();
  });
}

test('the server serves files of site/ and answers 404 outside it', { timeout: 5000 }, async () => {
  const server = createSiteServer(SITE);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const index = await get(port, '/index.html');
    assert.equal(index.status, 200);
    assert.equal(index.type, 'text/html; charset=utf-8');
    assert.match(index.body, /^<!doctype html>/i);
    const script = await get(port, '/js/ui/main.js');
    assert.equal(script.status, 200);
    assert.equal(script.type, 'text/javascript; charset=utf-8');
    const notFound = { status: 404, type: 'text/plain; charset=utf-8', body: '404' };
    assert.deepEqual(await get(port, '/no-existe.html'), notFound);
    assert.deepEqual(await get(port, '/js/'), notFound);
    assert.deepEqual(await get(port, '/js/../../package.json'), notFound);
    assert.deepEqual(await get(port, '/%2e%2e/package.json'), notFound);
    assert.deepEqual(await get(port, '/%E0%A4%A'), notFound);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('run as a script it serves site/ on the PORT given', { timeout: 5000 }, async () => {
  const child = spawn(process.execPath, [join(import.meta.dirname, 'serve-site.mjs')], {
    env: { ...process.env, PORT: '0' },
  });
  try {
    const [line] = await once(child.stdout, 'data');
    const match = /^Sirviendo site\/ en http:\/\/127\.0\.0\.1:(\d+)\/$/m.exec(String(line));
    assert.ok(match, String(line));
    const port = Number(match[1]);
    assert.notEqual(port, 4173);
    const index = await get(port, '/');
    assert.equal(index.status, 200);
    assert.match(index.body, /<title>/);
  } finally {
    child.kill();
  }
});
