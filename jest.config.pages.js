import baseConfig from './jest.config.js';

export default {
  ...baseConfig,
  testEnvironment: 'jsdom',
  testMatch: [
    '**/tests/pages/**/*.(test|spec).+(ts|tsx|js)'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/test-env-setup.js',
    '<rootDir>/tests/setup.ts'
  ]
};