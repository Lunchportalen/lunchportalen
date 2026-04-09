import "server-only";

import { assertNotKilled } from "@/lib/settings/enforce";
import type { SystemSettings } from "@/lib/system/settings";

/** Hard fail-closed når `killswitch.global === true` (én sannhetslinje via enforce). */
export function assertSystemAlive(settings: SystemSettings | null | undefined): void {
  assertNotKilled(settings, "global");
}
