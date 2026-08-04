import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierPlugin from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'templates/**',
      'coverage/**',
    ],
  },
  eslint.configs.recommended,
  prettierConfig,
  {
    plugins: { prettier: prettierPlugin },
    rules: { 'prettier/prettier': 'error' },
  },

  // Apps Script sources and shared libs.
  {
    files: ['apps/*/src/**/*.ts', 'libs/**/*.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      parserOptions: { project: './tsconfig.json' },
      globals: { ...globals.es2020 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Build tooling: plain Node ESM, no TypeScript program.
  {
    files: ['*.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node },
    },
  }
)
