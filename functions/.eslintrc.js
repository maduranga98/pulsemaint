module.exports = {
  env: {
    es2022: true,
    node: true,
  },
  parserOptions: {
    "ecmaVersion": 2022,
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
    "max-len": "off",
    "require-jsdoc": "off",
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
