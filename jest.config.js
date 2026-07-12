/** Jest config for Expo SDK 54. Pure-logic (src/lib, src/data) and component tests. */
module.exports = {
  preset: 'jest-expo',
  // Note: rely on jest-expo's tuned transformIgnorePatterns; only add path aliases.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
