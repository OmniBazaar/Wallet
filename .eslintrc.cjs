module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: [
    '@typescript-eslint',
    'prettier'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  env: {
    browser: true,
    webextensions: true,
    node: true,
    es2022: true,
    jest: true
  },
  ignorePatterns: [
    'dist/**',
    'node_modules/**',
    'coverage/**',
    'cypress/**',
    'DePay/**',
    'source-repos/**',
    'static/**',
    'scripts/**',
    'hardhat.config.ts',
    'vite.config.ts',
    'jest.config.js',
    'playwright.config.ts',
    '*.js'
  ],
  rules: {
    // Console logging - warn except for warn/error
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    
    // TypeScript strict rules as per coding standards
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: true,
      allowDirectConstAssertionInArrowFunctions: true
    }],
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase']
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase']
      },
      {
        selector: 'enum',
        format: ['PascalCase']
      },
      {
        selector: 'enumMember',
        format: ['UPPER_CASE']
      }
    ],
    'prefer-const': 'error',
    'no-var': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    
    // Allow empty functions in certain cases (browser extension context)
    '@typescript-eslint/no-empty-function': 'off'
  },
  overrides: [
    {
      files: ['tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        // More lenient rules for test files
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-console': 'off'
      }
    }
  ]
}; 