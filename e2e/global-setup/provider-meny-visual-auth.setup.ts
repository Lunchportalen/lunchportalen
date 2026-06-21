// e2e/global-setup/provider-meny-visual-auth.setup.ts
import type { FullConfig } from "@playwright/test";

import { assertVisualE2eSanityDatasetNotProduction } from "../helpers/visual-e2e-sanity-guard";
import { createProviderMenyVisualKitchenStorageState } from "../helpers/provider-meny-visual-auth";

async function globalSetup(config: FullConfig): Promise<void> {
  assertVisualE2eSanityDatasetNotProduction();

  const baseURL =
    config.projects[0]?.use?.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://localhost:3000";

  await createProviderMenyVisualKitchenStorageState(String(baseURL));
}

export default globalSetup;
