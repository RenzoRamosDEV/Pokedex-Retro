// @ts-check
import { mapPokemon } from '../mappers/pokemon.js';
import { mapMove } from '../mappers/move.js';
import { mapNature } from '../mappers/nature.js';
import { mapItem } from '../mappers/item.js';
import { mapBerry } from '../mappers/berry.js';
import { mapType } from '../mappers/type.js';
import { mapAbility } from '../mappers/ability.js';

const paginated = (resource, pageSize, mapper) => ({ resource, pageSize, listLimit: null, mapper, exclude: [] });

const unpaginated = (resource, mapper, exclude = []) => ({ resource, pageSize: null, listLimit: 100, mapper, exclude });

export const SECTIONS = {
  pokedex: paginated('pokemon', 18, mapPokemon),
  movimientos: paginated('move', 16, mapMove),
  naturalezas: unpaginated('nature', mapNature),
  objetos: paginated('item', 12, mapItem),
  bayas: paginated('berry', 15, mapBerry),
  tipos: unpaginated('type', mapType, ['unknown', 'shadow']),
  habilidades: paginated('ability', 8, mapAbility),
};
