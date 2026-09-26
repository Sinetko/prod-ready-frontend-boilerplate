import js from '@eslint/js';
import graphql from '@graphql-eslint/eslint-plugin';
import stylistic from '@stylistic/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { fileURLToPath } from 'node:url';

const codeFiles = ['**/*.{js,mjs,cjs,ts,tsx}'];

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'autotests/**',
      '.husky/**',
      '.claude/cache/**',
      // Codegen owns these outputs; lint their source documents instead.
      'src/graphql/graphql-api-types.ts',
      'src/graphql/schema.graphql',
      'src/graphql/documents.graphql',
    ],
  },
  { ...js.configs.recommended, files: codeFiles },
  {
    files: codeFiles,
    plugins: { '@stylistic': stylistic, import: importPlugin },
    languageOptions: { globals: globals.node },
    settings: { 'import/resolver': { typescript: { project: './tsconfig.json' }, node: true } },
    rules: {
      'no-bitwise': 'error',
      'no-shadow': 'error',
      'no-redeclare': 'error',
      'no-unused-expressions': 'error',
      'max-classes-per-file': ['error', 1],
      'import/no-duplicates': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json', './tsconfig.vite.json'],
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      'no-shadow': 'off',
      'no-redeclare': 'off',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-redeclare': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.tsx'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/prop-types': 'off',
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  { ...prettierRecommended, files: codeFiles },
  {
    files: codeFiles,
    rules: { '@stylistic/max-len': ['warn', { code: 120 }] },
  },
  {
    files: ['src/bootstrap/namespace-map.ts'],
    rules: {
      '@stylistic/max-len': 'off',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        { selector: 'property', modifiers: ['requiresQuotes'], format: null },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/graphql/graphql-api-types.ts'],
    processor: graphql.processor,
  },
  {
    files: ['**/*.graphql'],
    ignores: ['src/graphql/schema.graphql'],
    languageOptions: { parser: graphql.parser },
    plugins: { '@graphql-eslint': graphql },
    rules: {
      '@graphql-eslint/known-type-names': 'error',
      '@graphql-eslint/known-directives': 'error',
      '@graphql-eslint/unique-directive-names-per-location': 'error',
    },
  },
  {
    files: ['src/graphql/{fragments,queries,mutations}/**/*.graphql'],
    rules: {
      '@graphql-eslint/executable-definitions': 'error',
      '@graphql-eslint/fields-on-correct-type': 'error',
      '@graphql-eslint/fragments-on-composite-type': 'error',
      '@graphql-eslint/known-argument-names': 'error',
      '@graphql-eslint/known-fragment-names': 'error',
      '@graphql-eslint/no-fragment-cycles': 'error',
      '@graphql-eslint/no-undefined-variables': 'error',
      '@graphql-eslint/no-unused-variables': 'error',
      '@graphql-eslint/overlapping-fields-can-be-merged': 'error',
      '@graphql-eslint/possible-fragment-spread': 'error',
      '@graphql-eslint/provided-required-arguments': 'error',
      '@graphql-eslint/scalar-leafs': 'error',
      '@graphql-eslint/unique-argument-names': 'error',
      '@graphql-eslint/unique-input-field-names': 'error',
      '@graphql-eslint/unique-variable-names': 'error',
      '@graphql-eslint/value-literals-of-correct-type': 'error',
      '@graphql-eslint/variables-are-input-types': 'error',
      '@graphql-eslint/variables-in-allowed-position': 'error',
    },
  },
];
