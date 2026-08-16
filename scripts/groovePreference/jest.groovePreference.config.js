/**
 * Offline Groove Preference collection/analysis.
 * Production realization is not imported or changed.
 */
module.exports = {
  preset: 'jest-expo',
  rootDir: '../..',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/scripts/groovePreference/*.harness.ts'],
  testTimeout: 60000,
};
