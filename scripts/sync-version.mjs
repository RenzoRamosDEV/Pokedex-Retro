import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..');

export function renderVersionModule(version) {
  return (
    '// Fichero generado por scripts/sync-version.mjs a partir de package.json. No editar a mano.\n' +
    `export const VERSION = '${version}';\n`
  );
}

export function syncVersion({ packageJsonPath, outputPath }) {
  const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (!version) throw new Error(`${packageJsonPath} no declara el campo "version"`);
  writeFileSync(outputPath, renderVersionModule(version));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncVersion({
    packageJsonPath: join(ROOT, 'package.json'),
    outputPath: join(ROOT, 'site', 'js', 'version.js'),
  });
}
