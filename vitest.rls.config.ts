import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts")
    }
  },
  test: {
    include: ["tests/rls/**/*.test.ts"],
    exclude: [
      "e2e/**",
      "**/*.spec.ts",
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "studio/node_modules/**",
      "studio/lunchportalen-studio/node_modules/**"
    ],
    environment: "node"
  }
});
