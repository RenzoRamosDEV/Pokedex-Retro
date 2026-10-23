import { escapeHtml } from '../core/html.js';
import { upper } from './layout.js';

const itemSprite = (item) => (item.sprite === null
  ? '<span class="shop-sprite-missing">?</span>'
  : `<img src="${escapeHtml(item.sprite)}" alt="${escapeHtml(item.name)}" class="shop-sprite">`);

const itemPrice = (item) => (item.cost
  ? `<span class="shop-price">${escapeHtml(item.cost)} ₽</span>`
  : '<span class="shop-price shop-price-free">—</span>');

const itemEffect = (item) => (item.shortEffect
  ? `<span class="shop-effect">${escapeHtml(item.shortEffect)}</span>`
  : '<span class="shop-effect shop-effect-empty">—</span>');

const itemRow = (item) => `
          <tr class="shop-row">
            <td class="shop-td-sprite">
              ${itemSprite(item)}
            </td>
            <td class="shop-td-name">
              <span class="shop-item-id">#${escapeHtml(item.id)}</span>
              <span class="shop-item-name">${upper(item.name)}</span>
            </td>
            <td class="shop-td-cat">
              <span class="shop-item-cat">${upper(item.category)}</span>
            </td>
            <td class="shop-td-price">
              ${itemPrice(item)}
            </td>
            <td class="shop-td-effect">
              ${itemEffect(item)}
            </td>
          </tr>`;

export const itemsView = {
  title: 'OBJETOS',
  searchable: true,
  renderItems: (items) => `
  <div class="shop-wrap">
    <table class="shop-table">
      <thead>
        <tr>
          <th class="shop-th-sprite"></th>
          <th class="shop-th-name">OBJETO</th>
          <th class="shop-th-cat">CATEGORÍA</th>
          <th class="shop-th-price">PRECIO</th>
          <th class="shop-th-effect">EFECTO</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(itemRow).join('')}
      </tbody>
    </table>
  </div>`,
};
