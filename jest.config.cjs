/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  collectCoverageFrom: ['src/shared/**/*.ts', '!src/**/*.d.ts'],
  moduleNameMapper: {
    '^@ecommerce/shared$': '<rootDir>/src/shared',
  },
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};

