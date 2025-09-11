module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
    // No project - disable type-aware linting
  },
  plugins: ['@typescript-eslint', 'jsdoc'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
    // Explicitly NOT including recommended-requiring-type-checking
  ],
  env: {
    browser: true,
    node: true,
    es2022: true,
    jest: true
  },
  rules: {
    // Basic ESLint rules
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'off', // Allow console in tests
    
    // Test files still need proper types - no any
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: true,
      allowDirectConstAssertionInArrowFunctions: true
    }],
    '@typescript-eslint/no-empty-function': 'off',
    
    // Test utilities should be documented
    'jsdoc/require-jsdoc': ['error', {
      publicOnly: false,
      require: {
        ArrowFunctionExpression: false,
        ClassDeclaration: true,
        ClassExpression: true,
        FunctionDeclaration: true,
        FunctionExpression: false,
        MethodDefinition: false
      },
      contexts: [
        'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
        'ExportNamedDeclaration > FunctionDeclaration'
      ]
    }],
    'jsdoc/require-description': ['error', {
      contexts: ['FunctionDeclaration', 'ClassDeclaration']
    }],
    'jsdoc/require-param': 'error',
    'jsdoc/require-param-description': 'error',
    'jsdoc/require-returns': 'error',
    'jsdoc/require-returns-description': 'error',
    'jsdoc/check-alignment': 'error',
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-tag-names': 'error'
  }
};