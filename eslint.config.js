// Flat ESLint config for Expo SDK 54.
// Extends Expo's recommended rules and disables formatting rules that conflict
// with Prettier (Prettier is the single source of truth for formatting).
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettier,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'ios/*', 'android/*', 'coverage/*'],
  },
];
