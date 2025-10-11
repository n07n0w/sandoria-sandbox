// Flat ESLint config for ESLint v9
import js from '@eslint/js';
import security from 'eslint-plugin-security';
import globals from 'globals';

export default [
  {
    ignores: [
      'logs/**',
      'DB/**',
      'public/fonts/**',
      'public/images/**',
      'public/javascripts/peerjs.min.js',
      'public/javascripts/peerjs.js', // ignore full (non-min) peerjs vendor file
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
      // Security plugin rules (set to warn to avoid failing CI initially)
      'security/detect-child-process': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'off', // can be noisy; enable later
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
      'security/detect-unsafe-regex': 'warn',
      // General style / quality
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      'no-console': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  // Treat specific ES module files as modules (they use export syntax)
  {
    files: [ 'public/javascripts/p2pConnection.js' ],
    languageOptions: { sourceType: 'module' }
  },
  // Provide jQuery globals for custom plugin scripts
  {
    files: [ 'public/javascripts/jquery.slidein.js', 'views/**/*.ejs', 'views/**/*.pug' ],
    languageOptions: {
      globals: { '$': 'readonly', jQuery: 'readonly' }
    },
    rules: {
      'no-undef': 'off'
    }
  }
];
