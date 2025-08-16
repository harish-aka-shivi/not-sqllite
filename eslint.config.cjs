// .eslintrc.cjs
module.exports = {
  extends: [
    "eslint:recommended", // Recommended ESLint rules
    "plugin:prettier/recommended", // Integrates Prettier with ESLint
  ],
  env: {
    browser: true, // Enable browser global variables
    node: true, // Enable Node.js global variables
    es2021: true, // Enable ES2021 syntax
  },
  parserOptions: {
    ecmaVersion: 2021, // Specify ECMAScript version
    sourceType: "module", // Use ES Modules
  },
  rules: {
    // Custom ESLint rules can be added here
  },
};
