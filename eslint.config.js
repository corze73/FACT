import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  // Configuration files (Node.js environment)
  {
    files: ['tailwind.config.js', 'vite.config.js', 'postcss.config.js', 'apps/web/tailwind.config.js', 'apps/web/vite.config.js', 'apps/web/postcss.config.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.node, module: true, require: true },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  // Server-side files (Node.js environment)
  {
    files: ['server.js', 'apps/web/src/api/email-routes.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  // Client-side files (Browser environment)
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['server.js', 'apps/web/src/api/email-routes.js', 'tailwind.config.js', 'vite.config.js', 'postcss.config.js', 'apps/web/tailwind.config.js', 'apps/web/vite.config.js', 'apps/web/postcss.config.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      // Disabled on request to keep console clean in production repos
      'react-refresh/only-export-components': 'off',
      'react/prop-types': 'off', // Disable prop-types validation
    },
  },
  // Node.js configuration for server and utility scripts
  {
    files: [
      'server.js',
      'apps/web/src/databaseClient.js',
      'test-*.js',
      'check-*.js',
      'debug-*.js',
      // utility/migration scripts and script folder
      '*-schema.js',
      'run-*.js',
      'migrate-*.js',
      'add-*.js',
      'fix-*.js',
      'scripts/**/*.js',
      'netlify/functions/**/*.js'
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
]
