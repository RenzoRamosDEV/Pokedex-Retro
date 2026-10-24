#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLogger } from '../src/log.js';
import { createServer } from '../src/server.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const log = createLogger({
  level: process.env.POKEDEX_MCP_LOG,
  write: (line) => process.stderr.write(line),
});
const server = createServer({ log, version });

await server.connect(new StdioServerTransport());
log.info(`servidor iniciado (v${version})`);
