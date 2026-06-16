export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import PilotControlCenterView from "@/components/superadmin/PilotControlCenterView";
import { loadPilotControlCenter } from "@/lib/superadmin/loadPilotControlCenter";

type SP = Record<string, string | string[] | undefined>;

function sp1(v: string | string[] | undefined) {
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

export default async function PilotControlPage(props: { searchParams?: SP | Promise<SP> }) {
  const sp = (await Promise.resolve(props.searchParams ?? {})) as SP;
  const data = await loadPilotControlCenter({
    companyId: sp1(sp.companyId) || undefined,
    providerId: sp1(sp.providerId) || undefined,
  });

  return <PilotControlCenterView data={data} />;
}
