import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSiteServer } from './serve-site.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUTPUT = join(ROOT, 'docs', 'media', 'demo.gif');

const MAX_BYTES = 3_000_000;
const MAX_SECONDS = 15;
const CLIP_SECONDS = 14;

const VIEWPORT = { width: 800, height: 560 };
const FPS = 8;
const MAX_COLORS = 32;

const SCRIPT_PAUSES_MS = {
  grid: 1500,
  search: 1500,
  dialog: 2500,
  closed: 500,
  theme: 1800,
  types: 2500,
};
const TYPING_DELAY_MS = 150;
const PIKACHU_CARD = 'a.card-link[href="#pokemon-25"]';
const OPEN_DIALOG = 'dialog.modal[open]';

export function checkGifLimits({ bytes, seconds }) {
  const problems = [];
  if (bytes > MAX_BYTES) problems.push(`demo.gif pesa ${bytes} bytes (máximo ${MAX_BYTES})`);
  if (seconds > MAX_SECONDS) problems.push(`demo.gif dura ${seconds} s (máximo ${MAX_SECONDS})`);
  return problems;
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function playScript(page, baseUrl) {
  const pause = (ms) => page.waitForTimeout(ms);
  const pageCreatedAt = performance.now();
  await page.goto(`${baseUrl}index.html`);
  await page.locator('.poke-card').first().waitFor();
  const trimSeconds = (performance.now() - pageCreatedAt) / 1000;
  await pause(SCRIPT_PAUSES_MS.grid);

  const search = page.locator('.search-input');
  await search.pressSequentially('pika', { delay: TYPING_DELAY_MS });
  await search.press('Enter');
  await page.locator(PIKACHU_CARD).waitFor();
  await pause(SCRIPT_PAUSES_MS.search);

  await page.locator(PIKACHU_CARD).click();
  await page.locator(OPEN_DIALOG).waitFor();
  await pause(SCRIPT_PAUSES_MS.dialog);

  await page.keyboard.press('Escape');
  await page.locator(OPEN_DIALOG).waitFor({ state: 'detached' });
  await pause(SCRIPT_PAUSES_MS.closed);

  await page.locator('#theme-btn').click();
  await page.locator('.theme-option[data-value="gb"]').click();
  await pause(SCRIPT_PAUSES_MS.theme);

  await page.goto(`${baseUrl}tipos.html`);
  await page.locator('.matrix-row-header').first().waitFor();
  await pause(SCRIPT_PAUSES_MS.types);
  return trimSeconds;
}

function encodeGif(video, trimSeconds) {
  const filter =
    `fps=${FPS},split[a][b];[a]palettegen=max_colors=${MAX_COLORS}:stats_mode=diff[p];` +
    '[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle';
  mkdirSync(join(ROOT, 'docs', 'media'), { recursive: true });
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-ss',
    trimSeconds.toFixed(3),
    '-t',
    String(CLIP_SECONDS),
    '-i',
    video,
    '-vf',
    filter,
    '-loop',
    '0',
    OUTPUT,
  ]);
}

function gifDurationSeconds() {
  const output = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUTPUT],
    { encoding: 'utf8' },
  );
  return Number(output.trim());
}

async function main() {
  const { chromium } = await import('@playwright/test');
  const { mockPokeApi } = await import('../tests/e2e/pokeapi-mock.js');
  const videoDir = mkdtempSync(join(tmpdir(), 'capture-demo-'));
  const server = createSiteServer(join(ROOT, 'site'));
  const browser = await chromium.launch();
  try {
    const port = await listen(server);
    const context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: { dir: videoDir, size: VIEWPORT },
      colorScheme: 'light',
      locale: 'es-ES',
    });
    const page = await context.newPage();
    const record = await mockPokeApi(page);
    const trimSeconds = await playScript(page, `http://127.0.0.1:${port}/`);
    await context.close();

    const problems = [
      ...record.external.map((url) => `petición externa sin simular: ${url}`),
      ...record.csp.map((message) => `violación de CSP: ${message}`),
    ];
    if (problems.length === 0) {
      encodeGif(await page.video().path(), trimSeconds);
      problems.push(
        ...checkGifLimits({ bytes: statSync(OUTPUT).size, seconds: gifDurationSeconds() }),
      );
    }
    for (const problem of problems) console.error(problem);
    if (problems.length > 0) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
    rmSync(videoDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
