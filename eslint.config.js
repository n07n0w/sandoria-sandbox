// CommonJS Flat ESLint config (converted from previous ESM version for Node 18 compatibility)
// NOTE: To eliminate the deprecated .eslintignore warning, delete the .eslintignore file (cannot remove automatically here).
const js = require('@eslint/js');
const security = require('eslint-plugin-security');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'logs/**',
      'DB/**',
      'public/fonts/**',
      'public/images/**',
      'public/javascripts/peerjs.min.js',
      'public/javascripts/peerjs.js',
      'public/javascripts/jquery-*.js',
      'public/javascripts/konva*.js'
    ]
  },
  {
    files: ['**/*.js','**/*.cjs','**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: { security },
    rules: {
      ...js.configs.recommended.rules,
      'security/detect-child-process': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'off',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
      'security/detect-unsafe-regex': 'warn',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  {
    files: [ 'public/javascripts/p2pConnection.js' ],
    languageOptions: { sourceType: 'module' }
  },
  {
    files: [ 'public/p2pConnection.js' ],
    languageOptions: { sourceType: 'module' }
  },
  {
    files: [ 'public/javascripts/jquery.slidein.js' ],
    languageOptions: { globals: { '$': 'readonly', jQuery: 'readonly' } },
    rules: { 'no-undef': 'off' }
  },
  {
    files: [ 'tests/**/*.js' ],
    languageOptions: { globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', beforeAll: 'readonly', afterAll: 'readonly' } }
  }
];
