import SystemGraphClient from "./SystemGraphClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SuperadminSystemGraphPage() {
  return <SystemGraphClient />;
}
