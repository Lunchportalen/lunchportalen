import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineCliConfig } from "sanity/cli";

const studioDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(studioDir, "..");

/**
 * WeekPlanner imports `lib/menu-publish/generateWeekMenu` (via studio re-export).
 * That module uses `@/` aliases — map them to the Next.js repo root for build/deploy.
 */
export default defineCliConfig({
  studioHost: "lunchportalen",
  api: {
    projectId: "4udoq5d8",
    dataset: "production",
  },
  deployment: {
    appId: "jwfxiop5eq51e0vmrfxsby4o",
    autoUpdates: false,
  },
  vite: {
    resolve: {
      alias: {
        "@": repoRoot,
      },
    },
  },
});