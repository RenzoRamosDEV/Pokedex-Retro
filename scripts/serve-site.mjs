import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_PORT = 4173;
const SITE_DIR = join(import.meta.dirname, '..', 'site');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

export function contentTypeFor(file) {
  return CONTENT_TYPES[extname(file)] ?? 'application/octet-stream';
}

function decodedPath(url) {
  try {
    return decodeURIComponent(url.split('?')[0]);
  } catch {
    return null;
  }
}

export function resolveInside(root, url) {
  const path = decodedPath(url);
  if (path === null) return null;
  const file = join(root, path === '/' ? 'index.html' : path);
  const fromRoot = relative(root, file);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) return null;
  return file;
}

function notFound(response) {
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('404');
}

export function createSiteServer(root) {
  return createServer(async (request, response) => {
    const file = resolveInside(root, request.url);
    if (file === null) return notFound(response);
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': contentTypeFor(file) });
      response.end(body);
    } catch {
      notFound(response);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const server = createSiteServer(SITE_DIR).listen(port, '127.0.0.1', () => {
    console.log(`Sirviendo site/ en http://127.0.0.1:${server.address().port}/`);
  });
}
