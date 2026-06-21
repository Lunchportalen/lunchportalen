// e2e/global-setup/provider-meny-visual-auth.setup.ts
import type { FullConfig } from "@playwright/test";

import { createProviderMenyVisualKitchenStorageState } from "../helpers/provider-meny-visual-auth";

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    config.projects[0]?.use?.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://localhost:3000";

  await createProviderMenyVisualKitchenStorageState(String(baseURL));
}

export default globalSetup;
