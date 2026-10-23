import { test, expect } from '@playwright/test';
import { mockPokeApi } from './pokeapi-mock.js';

const PAGES = [
  { file: 'index.html', title: 'POKÉDEX — Retro Edition', item: '.poke-card' },
  { file: 'movimientos.html', title: 'MOVIMIENTOS — Pokédex Retro', item: '.move-card' },
  { file: 'tipos.html', title: 'TIPOS — Pokédex Retro', item: '.matrix-row-header' },
  { file: 'habilidades.html', title: 'HABILIDADES — Pokédex Retro', item: '.ability-card' },
  { file: 'naturalezas.html', title: 'NATURALEZAS — Pokédex Retro', item: '.acc-nature-row' },
  { file: 'objetos.html', title: 'OBJETOS — Pokédex Retro', item: '.shop-row' },
  { file: 'bayas.html', title: 'BAYAS — Pokédex Retro', item: '.berry-card' },
];

let record;

test.beforeEach(async ({ page }) => {
  record = await mockPokeApi(page);
});

test.afterEach(() => {
  expect(record.external, 'peticiones externas sin simular').toEqual([]);
  expect(record.csp, 'violaciones de CSP').toEqual([]);
});

for (const { file, title, item } of PAGES) {
  test(`${file} loads its title and at least one element`, async ({ page }) => {
    await page.goto(file);
    await expect(page).toHaveTitle(title);
    await expect(page.locator(item).first()).toBeVisible();
  });
}

test('searching pika shows only Pikachu', async ({ page }) => {
  await page.goto('index.html');
  await expect(page.locator('.poke-card').first()).toBeVisible();
  await page.locator('.search-input').fill('pika');
  await page.locator('.search-input').press('Enter');
  await expect(page).toHaveURL(/index\.html\?q=pika$/);
  await expect(page.locator('.poke-card')).toHaveCount(1);
  await expect(page.locator('.card-number')).toHaveText('#25');
});

test('the next page link goes to page 2 of 3', async ({ page }) => {
  await page.goto('index.html');
  await page.getByRole('link', { name: 'SIG. ▶' }).click();
  await expect(page).toHaveURL(/\?page=2$/);
  await expect(page.locator('.card-number').first()).toHaveText('#19');
  await expect(page.locator('.pagination .page-info')).toHaveText('2 / 3');
});

test('the DMG theme chosen with the mouse persists after reloading', async ({ page }) => {
  await page.goto('index.html');
  await page.locator('#theme-btn').click();
  await page.locator('.theme-option[data-value="gb"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'gb');
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'gb');
});

const statusRegion = (page) => page.locator('main [role="status"]');

test('the first Tab focuses a visible skip link and Enter moves focus to main', async ({
  page,
}) => {
  await page.goto('tipos.html');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#contenido')).toBeFocused();
});

for (const { file, item } of PAGES) {
  test(`${file} leaves the status region empty after a correct load`, async ({ page }) => {
    await page.goto(file);
    await expect(page.locator(item).first()).toBeVisible();
    await expect(statusRegion(page)).toHaveCount(1);
    await expect(statusRegion(page)).toHaveText('');
  });
}

test('a search without matches says SIN RESULTADOS in the status region', async ({ page }) => {
  await page.goto('index.html?q=zzz');
  await expect(statusRegion(page)).toHaveText('SIN RESULTADOS');
});

test('a failing list shows the load error in the status region', async ({ page }) => {
  await page.route(
    (url) => url.href.startsWith('https://pokeapi.co/api/v2/pokemon?'),
    (route) => route.fulfill({ status: 500, body: '' }),
  );
  await page.goto('index.html');
  await expect(statusRegion(page)).toHaveText(
    'No se pudieron cargar los datos. Inténtalo de nuevo más tarde.',
  );
});
