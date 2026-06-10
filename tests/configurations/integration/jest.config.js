/** @type {import('jest').Config} */
module.exports = {
  globalSetup: '<rootDir>/tests/configurations/integration/globalSetup.js',
  transform: {
    // using ^.+\\.[tj]s$ instead of ^.+\\.ts$ to also transform .js files in node_modules (e.g., change-case) that are ESM-only and need to be transpiled for jest's CJS runtime
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'tsconfig.test.json', isolatedModules: true }],
  },
  // `change-case` is ESM-only; transpile it (don't ignore it) so jest's CJS runtime can load it.
  transformIgnorePatterns: ['/node_modules/(?!change-case)'],
  coverageReporters: ['text', 'html'],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!*/node_modules/',
    '!/vendor/**',
    '!*/common/**',
    '!**/models/**',
    '!<rootDir>/src/*',
    '!*/db/**',
    '<rootDir>/src/polygonParts/**/*.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  rootDir: '../../../.',
  testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
  setupFiles: ['<rootDir>/tests/configurations/jest.setup.ts'],
  setupFilesAfterEnv: [
    'jest-openapi',
    'jest-extended/all',
    'jest-geojson/setup/all',
    '<rootDir>/tests/configurations/initJestOpenapi.setup.ts',
    '<rootDir>/tests/configurations/initJestGeoJson.setup.ts',
    '<rootDir>/tests/configurations/initJestExtended.setup.ts',
    '<rootDir>/tests/configurations/initCustomMatchers.setup.ts',
  ],
  reporters: [
    'default',
    [
      'jest-html-reporters',
      { multipleReportsUnitePath: './reports', pageTitle: 'integration', publicPath: './reports', filename: 'integration.html' },
    ],
  ],
  moduleDirectories: ['node_modules', 'src'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 60,
      lines: 55,
      statements: -350,
    },
  },
};
