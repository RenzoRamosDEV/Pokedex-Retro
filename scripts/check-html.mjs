import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REFERENCE_FILE = 'index.html';
const DEFAULT_SITE_DIR = join(import.meta.dirname, '..', 'site');

export function extractHeader(html) {
  return html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? null;
}

function headerWithoutOwnMark({ file, html }) {
  const header = extractHeader(html);
  const ownMark = `<a href="${file}" class="nav-link active" aria-current="page">`;
  if (!header?.includes(ownMark)) return null;
  return header.replace(ownMark, `<a href="${file}" class="nav-link">`);
}

export function findHeaderMismatches(pages) {
  const reference = headerWithoutOwnMark(pages.find((page) => page.file === REFERENCE_FILE));
  return pages
    .filter((page) => {
      const header = headerWithoutOwnMark(page);
      return header === null || header !== reference;
    })
    .map((page) => page.file);
}

function readPages(dir) {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.html'))
    .sort()
    .map((file) => ({ file, html: readFileSync(join(dir, file), 'utf8') }));
}

function main(dir = DEFAULT_SITE_DIR) {
  const pages = readPages(dir);
  const mismatches = findHeaderMismatches(pages);
  for (const file of mismatches) console.error(`Cabecera distinta en: ${file}`);
  if (mismatches.length > 0) return 1;
  console.log(`Cabeceras coherentes en ${pages.length} páginas.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv[2]);
}
