import { upper } from './layout.js';
import { groupNatures } from '../mappers/nature.js';
import { STRINGS } from './strings.js';

const natureRow = (name, sub, subClass = '') => `
                      <div class="acc-nature-row">
                        <span class="acc-nature-name">${upper(name)}</span>
                        <span class="acc-nature-sub${subClass}">${sub}</span>
                      </div>`;

const statSection = (group) => `
              <div class="acc-section">
                <input type="checkbox" id="acc-${group.stat}" class="acc-toggle"${group.stat === 'attack' ? ' checked' : ''}>
                <label for="acc-${group.stat}" class="acc-header acc-stat-${group.stat}">
                  <span class="acc-icon">—</span>
                  <span class="acc-stat-name">${group.label}</span>
                  <span class="acc-counts">
                    <span class="acc-count-up">↑ ${group.up.length}</span>
                    <span class="acc-count-down">↓ ${group.down.length}</span>
                  </span>
                  <span class="acc-arrow">▶</span>
                </label>
                <div class="acc-body">
                  <div class="acc-col acc-up">
                    <div class="acc-col-header">↑ ${STRINGS.naturalezas.sube} ${group.label}</div>
                    ${group.up.map((n) => natureRow(n.name, `↓ ${upper(n.decreasedStat ?? '—')}`)).join('')}
                  </div>
                  <div class="acc-col acc-down">
                    <div class="acc-col-header">↓ ${STRINGS.naturalezas.baja} ${group.label}</div>
                    ${group.down.map((n) => natureRow(n.name, `↑ ${upper(n.increasedStat ?? '—')}`)).join('')}
                  </div>
                </div>
              </div>`;

const neutralColumn = (natures) => `
                <div class="acc-col">
                  <div class="acc-col-header">${STRINGS.naturalezas.sinCambio}</div>
                  ${natures.map((n) => natureRow(n.name, `— ${STRINGS.naturalezas.neutral}`, ' acc-neutral-tag')).join('')}
                </div>`;

function neutralSection(neutrals) {
  if (neutrals.all.length === 0) return '';
  return `
            <div class="acc-section">
              <input type="checkbox" id="acc-neutral" class="acc-toggle">
              <label for="acc-neutral" class="acc-header acc-stat-neutral">
                <span class="acc-icon">—</span>
                <span class="acc-stat-name">${STRINGS.naturalezas.neutral}</span>
                <span class="acc-counts">
                  <span class="acc-count-up">${neutrals.all.length} ${STRINGS.naturalezas.naturales}</span>
                </span>
                <span class="acc-arrow">▶</span>
              </label>
              <div class="acc-body">
                ${neutralColumn(neutrals.left)}
                ${neutralColumn(neutrals.right)}
              </div>
            </div>`;
}

export const naturesView = {
  title: STRINGS.naturalezas.titulo,
  searchable: false,
  renderItems: (natures) => {
    const { statGroups, neutrals } = groupNatures(natures);
    return `
        <div class="stat-accordion">
          ${statGroups.map(statSection).join('')}
          ${neutralSection(neutrals)}
        </div>`;
  },
};
