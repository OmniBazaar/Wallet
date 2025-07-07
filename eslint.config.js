import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...vuePlugin.configs['flat/recommended'],
    {
        files: ['**/*.{ts,tsx,vue}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.node,
                chrome: 'readonly'
            },
            parser: vueParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                parser: '@typescript-eslint/parser',
                extraFileExtensions: ['.vue']
            }
        },
        rules: {
            // Vue-specific rules
            'vue/multi-word-component-names': 'off',
            'vue/no-unused-vars': 'error',
            'vue/component-definition-name-casing': ['error', 'PascalCase'],
            
            // TypeScript rules
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { 
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            '@typescript-eslint/ban-ts-comment': 'warn',
            
            // General rules
            'no-console': 'off', // Allow console for debugging
            'prefer-const': 'error',
            'no-var': 'error'
        }
    },
    {
        files: ['**/*.vue'],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: '@typescript-eslint/parser'
            }
        }
    }
); 