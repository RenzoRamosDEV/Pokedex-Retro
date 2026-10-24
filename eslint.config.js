import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'reports/',
      '.stryker-tmp/',
      'requirements/',
      '.serena/',
      '.claude/',
      'test-results/',
      'playwright-report/',
      '.lighthouseci/',
    ],
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['site/js/core/**/*.js', 'site/js/mappers/**/*.js'],
    languageOptions: {
      globals: { URLSearchParams: 'readonly' },
    },
  },
  {
    files: ['site/js/chat/**/*.js'],
    languageOptions: {
      globals: { TextDecoder: 'readonly', structuredClone: 'readonly' },
    },
  },
  {
    files: ['site/js/ui/**/*.js', 'site/js/api/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: [
      '**/*.test.js',
      'scripts/**/*.{js,mjs}',
      'tests/support/**/*.js',
      'mcp/**/*.js',
      'eslint.config.js',
      'playwright.config.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['mcp/src/**/*.js', 'mcp/bin/**/*.js'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  eslintConfigPrettier,
];
