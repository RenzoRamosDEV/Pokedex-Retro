// @ts-check
import { anthropic } from './anthropic.js';
import { openai } from './openai.js';

export const PROVEEDORES = { anthropic, openai };

export const PROVEEDOR_POR_DEFECTO = 'anthropic';
