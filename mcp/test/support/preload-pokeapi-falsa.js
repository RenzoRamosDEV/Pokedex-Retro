import { createFakePokeApi } from './pokeapi-falsa.js';

globalThis.fetch = createFakePokeApi().fetch;
