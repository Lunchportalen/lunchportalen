/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "next/typescript"],

  rules: {
    // Migration: alt dette skal ikke stoppe push
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/ban-ts-comment": "off"
  },

  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      excludedFiles: ["lib/ai/runner.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@/lib/ai/_internalProvider",
                message: "AI internal provider is private; import from @/lib/ai/runner only.",
              },
              {
                name: "@/lib/ai/provider",
                message: "lib/ai/provider was removed; import from @/lib/ai/runner only.",
              },
            ],
            patterns: [
              {
                group: ["**/_internalProvider", "**/lib/ai/_internalProvider"],
                message: "AI internal provider is private; import from @/lib/ai/runner only.",
              },
            ],
          },
        ],
      },
    },
  ],
};
