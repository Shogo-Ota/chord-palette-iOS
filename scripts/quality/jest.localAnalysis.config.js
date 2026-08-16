/**
 * Runner for the observe-only harnesses that live under LocalAnalysis/.
 * They are excluded from the app suite (see jest.config.js) because a forensic
 * audit describes the code, it does not decide whether the code ships.
 */
module.exports = {
  preset: 'jest-expo',
  rootDir: '../..',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/LocalAnalysis/**/*.test.ts'],
  testTimeout: 300000,
};
