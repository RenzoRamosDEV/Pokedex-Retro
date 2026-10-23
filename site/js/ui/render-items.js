import { escapeHtml } from '../core/html.js';
import { upper } from './layout.js';
import { STRINGS } from './strings.js';

const itemSprite = (item) =>
  item.sprite === null
    ? '<span class="shop-sprite-missing">?</span>'
    : `<img src="${escapeHtml(item.sprite)}" alt="${escapeHtml(item.name)}" class="shop-sprite" width="30" height="30" loading="lazy" decoding="async">`;

const itemPrice = (item) =>
  item.cost
    ? `<span class="shop-price">${escapeHtml(item.cost)} ₽</span>`
    : '<span class="shop-price shop-price-free">—</span>';

const itemEffect = (item) =>
  item.shortEffect
    ? `<span class="shop-effect">${escapeHtml(item.shortEffect)}</span>`
    : '<span class="shop-effect shop-effect-empty">—</span>';

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
  title: STRINGS.objetos.titulo,
  searchable: true,
  renderItems: (items) => `
  <div class="shop-wrap" tabindex="0" role="region" aria-label="${STRINGS.objetos.titulo}">
    <table class="shop-table">
      <thead>
        <tr>
          <th class="shop-th-sprite"></th>
          <th class="shop-th-name">${STRINGS.objetos.objeto}</th>
          <th class="shop-th-cat">${STRINGS.objetos.categoria}</th>
          <th class="shop-th-price">${STRINGS.objetos.precio}</th>
          <th class="shop-th-effect">${STRINGS.objetos.efecto}</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(itemRow).join('')}
      </tbody>
    </table>
  </div>`,
};
