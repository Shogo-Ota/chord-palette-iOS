/**
 * Offline POP909 prior PoC. Does not import or modify production realize.
 */
module.exports = {
  preset: 'jest-expo',
  rootDir: '../..',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/scripts/pop909/*.harness.ts'],
  testTimeout: 300000,
};
