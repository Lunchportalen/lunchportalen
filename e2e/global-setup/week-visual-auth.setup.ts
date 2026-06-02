// e2e/global-setup/week-visual-auth.setup.ts — One-shot employee login for week visual (STEG 0)
import type { FullConfig } from "@playwright/test";

import { createWeekVisualEmployeeStorageState } from "../helpers/week-visual-auth";

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    config.projects[0]?.use?.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://localhost:3000";

  await createWeekVisualEmployeeStorageState(String(baseURL));
}

export default globalSetup;
