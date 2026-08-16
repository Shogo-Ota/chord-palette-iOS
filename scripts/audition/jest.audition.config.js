/**
 * Runner for the audition harness (`npm run audition`).
 *
 * Same preset and path aliases as the test suite, so the harness renders through the
 * code the app ships — but a separate `testMatch` so `*.harness.ts` never runs as part
 * of `npx jest`, and no coverage/watch noise.
 */
module.exports = {
  preset: 'jest-expo',
  rootDir: '../..',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/scripts/audition/*.harness.ts'],
};
