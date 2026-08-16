/** Jest config for Expo SDK 54. Pure-logic (src/lib, src/data) and component tests. */
module.exports = {
  preset: 'jest-expo',
  // Note: rely on jest-expo's tuned transformIgnorePatterns; only add path aliases.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // `dist-check/` is an unpacked build artifact, and `LocalAnalysis/` holds
  // observe-only audit harnesses. Neither may decide whether the app suite is green.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/dist-check/',
    '<rootDir>/LocalAnalysis/',
  ],
};
