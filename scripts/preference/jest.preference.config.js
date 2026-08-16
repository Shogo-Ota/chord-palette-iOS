/**
 * Offline preference collection / analysis. Does not import production realize.
 */
module.exports = {
  preset: 'jest-expo',
  rootDir: '../..',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/scripts/preference/*.harness.ts'],
  testTimeout: 60000,
};
