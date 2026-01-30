// vitest.config.ts
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

// Last inn .env.local (fallback til .env)
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export default defineConfig({
  plugins: [
    // ✅ gjør at @/… resolves via tsconfig.json paths (samme som Next)
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      // ✅ FIKS: Vitest kjenner ikke "server-only" (Next.js helper)
      // Mapper til tom mock slik at tester ikke krasjer
      "server-only": path.resolve(__dirname, "app/tests/_mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
