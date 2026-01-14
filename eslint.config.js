'use strict';

const config = require('@masteringjs/eslint-config');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  {
    ignores: ['frontend/public/*', 'frontend/public/**']
  },
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        fetch: true,
        setTimeout: true,
        process: true,
        console: true
      }
    },
    extends: [config]
  },
  {
    files: ['frontend/src/**/*.js', 'frontend/src/*.js', 'frontend/index.js'],
    languageOptions: {
      globals: {
        Prism: true,
        window: true,
        document: true,
        console: true,
        Vue: true,
        VueRouter: true,
        CodeMirror: true,
        Chart: true,
        URLSearchParams: true,
        URL: true,
        fetch: true,
        __dirname: true,
        process: true,
        setTimeout: true,
        navigator: true,
        TextDecoder: true
      },
      sourceType: 'commonjs'
    },
    extends: [config]
  }
]);
