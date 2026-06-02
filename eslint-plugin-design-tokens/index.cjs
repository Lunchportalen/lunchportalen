/** Local ESLint plugin — design token enforcement (Apple-lift STEG 1). */
module.exports = {
  rules: {
    "no-arbitrary": require("../eslint-rules/no-design-token-arbitrary.cjs"),
  },
};
