module.exports = {
  extends: ['../../.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      rules: {
        'jsdoc/require-jsdoc': 0,
      },
    },
  ],
  ignorePatterns: ['!.eslintrc.js', 'build/'],
};
