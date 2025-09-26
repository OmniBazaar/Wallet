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
    'prettier',
    'jsdoc',
    'vue'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:vue/vue3-essential',
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
    '*.js',
    '*.cjs',
    '.eslintrc.cjs',
    '**/*.vue',  // Exclude Vue files since project uses React/TSX primarily
    'tests/**/*.ts',  // Temporarily ignore test files
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  rules: {
    // Console logging - warn except for warn/error
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    
    // TypeScript strict rules as per coding standards
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/strict-boolean-expressions': ['error', {
      allowString: false,
      allowNumber: false,
      allowNullableObject: false,
      allowNullableBoolean: false,
      allowNullableString: false,
      allowNullableNumber: false,
      allowAny: false
    }],
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true
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
        format: ['UPPER_CASE', 'PascalCase', 'camelCase']
      }
    ],
    'prefer-const': 'error',
    'no-var': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    
    // Allow empty functions in certain cases (browser extension context)
    '@typescript-eslint/no-empty-function': 'off',
    
    // JSDoc rules - enforce documentation for all exports
    'jsdoc/require-jsdoc': ['error', {
      publicOnly: true,
      require: {
        ArrowFunctionExpression: true,
        ClassDeclaration: true,
        ClassExpression: true,
        FunctionDeclaration: true,
        FunctionExpression: true,
        MethodDefinition: true
      },
      contexts: [
        'TSInterfaceDeclaration',
        'TSTypeAliasDeclaration',
        'TSEnumDeclaration',
        'TSMethodSignature',
        'TSPropertySignature',
        'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
        'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > FunctionExpression',
        'ExportDefaultDeclaration > ArrowFunctionExpression',
        'ExportDefaultDeclaration > FunctionExpression'
      ]
    }],
    'jsdoc/require-description': ['error', {
      contexts: ['any']
    }],
    'jsdoc/require-param': 'error',
    'jsdoc/require-param-description': 'error',
    'jsdoc/require-param-type': 'off', // TypeScript provides types
    'jsdoc/require-returns': 'error',
    'jsdoc/require-returns-description': 'error',
    'jsdoc/require-returns-type': 'off', // TypeScript provides types
    'jsdoc/check-alignment': 'error',
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-tag-names': 'error'
  },
  overrides: [
    {
      files: ['tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: undefined // Explicitly disable type-aware linting
      },
      plugins: ['@typescript-eslint', 'jsdoc'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
        // Explicitly NOT including recommended-requiring-type-checking
      ],
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
    },
    {
      files: ['src/examples/**/*.ts'],
      rules: {
        // Allow console statements in examples
        'no-console': 'off',
        // Allow non-null assertions in examples
        '@typescript-eslint/no-non-null-assertion': 'off'
      }
    },
    {
      files: ['src/utils/logger.ts', 'src/**/logger.ts', 'src/**/Logger.ts'],
      rules: {
        // Allow console statements in logger utilities
        'no-console': 'off'
      }
    },
    {
      files: ['scripts/**/*.ts'],
      parserOptions: {
        project: null // Disable type-aware linting for scripts
      },
      rules: {
        // More lenient rules for scripts
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        // Disable type-aware rules for scripts
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/strict-boolean-expressions': 'off',
        'no-console': 'off'
      }
    },
    {
      files: ['*.vue'],
      parser: 'vue-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.vue']
      },
      rules: {
        // More lenient JSDoc rules for Vue components
        'jsdoc/require-jsdoc': 'off'
      }
    }
  ]
}; 