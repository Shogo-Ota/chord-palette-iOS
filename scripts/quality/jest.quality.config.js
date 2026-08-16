/**
 * Runner for the accompaniment quality audit / experiment harnesses.
 * Same aliases as the app test suite so every measurement goes through
 * production code rather than a second generator.
 */
module.exports = {
  preset: 'jest-expo',
  rootDir: '../..',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/scripts/quality/*.harness.ts'],
  testTimeout: 300000,
};
