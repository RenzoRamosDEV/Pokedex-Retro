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
