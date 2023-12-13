module.exports = {
  extends: ['../../.eslintrc.js'],
  ignorePatterns: ['!.eslintrc.js', 'dist/'],
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
};
