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

const card25 = (page) => page.locator('a.card-link[href="#pokemon-25"]');
const openDialog = (page) => page.locator('dialog.modal[open]');

async function openPikachuWithKeyboard(page, url = 'index.html?page=2') {
  await page.goto(url);
  await card25(page).focus();
  await page.keyboard.press('Enter');
  await expect(openDialog(page)).toHaveAttribute('id', 'pokemon-25');
}

test('Modal con teclado: Enter opens, Escape closes and focus returns to the card', async ({
  page,
}) => {
  await openPikachuWithKeyboard(page);
  await expect(page.locator('#pokemon-25 [data-cerrar]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(openDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(/index\.html\?page=2$/);
  await expect(card25(page)).toBeFocused();
});

test('Cierre con el botón: Enter on close closes and focus returns to the card', async ({
  page,
}) => {
  await openPikachuWithKeyboard(page);
  await page.keyboard.press('Enter');
  await expect(openDialog(page)).toHaveCount(0);
  await expect(card25(page)).toBeFocused();
});

test('Clic en el fondo: a click outside the panel closes the dialog', async ({ page }) => {
  await openPikachuWithKeyboard(page);
  await page.mouse.click(5, 5);
  await expect(openDialog(page)).toHaveCount(0);
});

test('Enlace profundo: loading #pokemon-25 on its page opens its dialog', async ({ page }) => {
  await page.goto('index.html?page=2#pokemon-25');
  await expect(openDialog(page)).toHaveAttribute('id', 'pokemon-25');
});

test('Hash al abrir y cerrar: the hash follows the dialog without new history entries', async ({
  page,
}) => {
  await page.goto('index.html?q=pika');
  await expect(card25(page)).toBeVisible();
  const historyLength = await page.evaluate(() => history.length);
  await card25(page).click();
  await expect(page).toHaveURL(/index\.html\?q=pika#pokemon-25$/);
  await page.locator('#pokemon-25 [data-cerrar]').click();
  await expect(page).toHaveURL(/index\.html\?q=pika$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
});

test('Pokémon fuera de la página: #pokemon-25 on page 1 opens nothing', async ({ page }) => {
  await page.goto('index.html#pokemon-25');
  await expect(page.locator('.poke-card').first()).toBeVisible();
  await expect(openDialog(page)).toHaveCount(0);
  await expect(page.locator('#pokemon-25')).toHaveCount(0);
});

test('the dialog accessible name is the Pokémon name', async ({ page }) => {
  await openPikachuWithKeyboard(page);
  await expect(page.getByRole('dialog', { name: 'PIKACHU', exact: true })).toBeVisible();
});

const themeButton = (page) => page.locator('#theme-btn');
const infoButton = (page) => page.locator('#info-btn');

async function loadedPokedex(page) {
  await page.goto('index.html');
  await expect(page.locator('.poke-card').first()).toBeVisible();
}

test('Abrir con teclado: Enter on the theme button shows its panel', async ({ page }) => {
  await loadedPokedex(page);
  await themeButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#theme-dropdown')).toBeVisible();
  await expect(themeButton(page)).toHaveAttribute('aria-expanded', 'true');
});

test('Escape: closes the theme panel and focuses its button', async ({ page }) => {
  await loadedPokedex(page);
  await themeButton(page).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('#theme-dropdown')).toBeHidden();
  await expect(themeButton(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(themeButton(page)).toBeFocused();
});

test('Un solo desplegable abierto: opening info hides the theme panel', async ({ page }) => {
  await loadedPokedex(page);
  await themeButton(page).click();
  await infoButton(page).click();
  await expect(page.locator('#info-dropdown')).toBeVisible();
  await expect(page.locator('#theme-dropdown')).toBeHidden();
  await expect(infoButton(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(themeButton(page)).toHaveAttribute('aria-expanded', 'false');
});

test('Elegir tema: DMG chosen with the keyboard applies gb and returns focus', async ({ page }) => {
  await loadedPokedex(page);
  await themeButton(page).focus();
  await page.keyboard.press('Enter');
  await page.locator('.theme-option[data-value="gb"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'gb');
  await expect(page.locator('#theme-dropdown')).toBeHidden();
  await expect(themeButton(page)).toBeFocused();
});
