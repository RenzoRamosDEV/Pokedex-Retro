#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPokeApiClient } from '../src/client.js';
import { createLogger } from '../src/log.js';
import { createServer } from '../src/server.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const log = createLogger({
  level: process.env.POKEDEX_MCP_LOG,
  write: (line) => process.stderr.write(line),
});
const { port } = createPokeApiClient({
  fetch: globalThis.fetch,
  env: process.env,
  homedir: homedir(),
  log,
  version,
});
const server = createServer({ port, log, version });

await server.connect(new StdioServerTransport());
log.info(`servidor iniciado (v${version})`);
