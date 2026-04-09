import AutonomyClient from "./AutonomyClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SuperadminAutonomyPage() {
  return <AutonomyClient />;
}
