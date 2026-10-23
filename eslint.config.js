import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['reports/', '.stryker-tmp/', 'requirements/', '.serena/', '.claude/'],
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
    files: ['site/js/ui/**/*.js', 'site/js/api/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.test.js', 'scripts/**/*.{js,mjs}', 'mcp/**/*.js', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
];
