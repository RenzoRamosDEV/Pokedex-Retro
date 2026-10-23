import { escapeHtml } from '../core/html.js';
import { upper } from './layout.js';
import { STRINGS } from './strings.js';

const abilityCard = (ability) => `
      <div class="ability-card">
        <div class="ability-card-left">
          <span class="ability-id">#${escapeHtml(ability.id)}</span>
          <h3 class="ability-card-name">${upper(ability.name)}</h3>
          <span class="ability-pokemon-count">${escapeHtml(ability.pokemonCount)} ${STRINGS.habilidades.pokemon}</span>
        </div>
        <div class="ability-card-right">
          <p class="ability-card-effect">${escapeHtml(ability.shortEffect)}</p>
        </div>
      </div>`;

export const abilitiesView = {
  title: STRINGS.habilidades.titulo,
  searchable: true,
  renderItems: (abilities) => `
  <div class="abilities-list">
    ${abilities.map(abilityCard).join('')}
  </div>`,
};
