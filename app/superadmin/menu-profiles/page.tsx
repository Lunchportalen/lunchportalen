export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import SuperadminMenuProfilesClient from "@/app/superadmin/menu-profiles/MenuProfilesClient";
import { loadSuperadminMenuProfileOverview } from "@/lib/server/superadmin/loadSuperadminMenuProfileOverview";

export default async function SuperadminMenuProfilesPage() {
  const data = await loadSuperadminMenuProfileOverview();
  return <SuperadminMenuProfilesClient data={data} />;
}
