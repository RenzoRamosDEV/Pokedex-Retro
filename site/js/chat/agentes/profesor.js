// @ts-check
import { DEFINICIONES } from '../herramientas.js';
import { BASE, REGLA_ALCANCE } from './alcance.js';
import { META } from './meta.js';
import { SKILLS } from './skills.js';
import { SUBAGENTES } from './subagentes.js';

/** @param {{ nombre: string, descripcion: string }[]} lista */
const listado = (lista) =>
  lista.map(({ nombre, descripcion }) => `- ${nombre}: ${descripcion}`).join('\n');

/**
 * The only agent that delegates or loads skills, so subagents stay at depth 1.
 * @type {import('./subagentes.js').Agente}
 */
export const PROFESOR = {
  nombre: 'profesor',
  sistema: `${BASE} ${REGLA_ALCANCE}

Subagentes (usa delegar_subagente solo si la tarea necesita varias consultas de su especialidad):
${listado(SUBAGENTES)}

Skills (cárgalas con usar_skill antes de seguirlas):
${listado(SKILLS)}`,
  herramientas: [...DEFINICIONES, ...META],
  maxIteraciones: 8,
};
