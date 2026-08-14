const fs = require('node:fs');
const path = require('node:path');

const swcJestConfig = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '.spec.swcrc'),
    'utf8',
  ),
);

swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@org/api-e2e',

  rootDir: '.',

  globalSetup:
    '<rootDir>/src/support/global-setup.ts',

  globalTeardown:
    '<rootDir>/src/support/global-teardown.ts',

  setupFiles: [
    '<rootDir>/src/support/test-setup.ts',
  ],

  testEnvironment: 'node',

  transform: {
    '^.+\\.[tj]s$': [
      '@swc/jest',
      swcJestConfig,
    ],
  },

  moduleFileExtensions: [
    'ts',
    'js',
    'html',
  ],

  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/src/**/*.test.ts',
  ],

  coverageDirectory:
    '<rootDir>/test-output/jest/coverage',

  passWithNoTests: true,

  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};