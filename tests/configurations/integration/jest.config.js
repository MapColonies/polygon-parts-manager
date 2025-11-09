/** @type {import('jest').Config} */
module.exports = {
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
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
      branches: 30,
      functions: 70,
      lines: 80,
      statements: -30,
    },
  },
};
