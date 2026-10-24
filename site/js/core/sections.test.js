import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS } from './sections.js';
import { mapPokemon } from '../mappers/pokemon.js';
import { mapMove } from '../mappers/move.js';
import { mapNature } from '../mappers/nature.js';
import { mapItem } from '../mappers/item.js';
import { mapBerry } from '../mappers/berry.js';
import { mapType } from '../mappers/type.js';
import { mapAbility } from '../mappers/ability.js';

describe('SECTIONS', () => {
  test('declares exactly the seven sections with their configuration', () => {
    assert.deepStrictEqual(SECTIONS, {
      pokedex: {
        resource: 'pokemon',
        pageSize: 18,
        listLimit: null,
        mapper: mapPokemon,
        exclude: [],
      },
      movimientos: {
        resource: 'move',
        pageSize: 16,
        listLimit: null,
        mapper: mapMove,
        exclude: [],
      },
      naturalezas: {
        resource: 'nature',
        pageSize: null,
        listLimit: 100,
        mapper: mapNature,
        exclude: [],
      },
      objetos: { resource: 'item', pageSize: 12, listLimit: null, mapper: mapItem, exclude: [] },
      bayas: { resource: 'berry', pageSize: 15, listLimit: null, mapper: mapBerry, exclude: [] },
      tipos: {
        resource: 'type',
        pageSize: null,
        listLimit: 100,
        mapper: mapType,
        exclude: ['stellar', 'unknown', 'shadow'],
      },
      habilidades: {
        resource: 'ability',
        pageSize: 8,
        listLimit: null,
        mapper: mapAbility,
        exclude: [],
      },
    });
  });
});
