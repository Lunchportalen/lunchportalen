// vitest.config.ts
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Last inn .env.local (fallback til .env hvis du vil)
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
