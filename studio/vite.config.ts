import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const studioDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(studioDir, "..");

/**
 * WeekPlanner re-exports `lib/menu-publish/generateWeekMenu`, which uses `@/` path aliases.
 * Map `@` to the Next.js repo root so `npx sanity build` / `deploy` resolve tagTaxonomy.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": repoRoot,
    },
  },
  server: {
    port: 3333,
  },
});
