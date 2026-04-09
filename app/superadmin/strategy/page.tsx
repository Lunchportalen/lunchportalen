import StrategyClient from "./StrategyClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SuperadminStrategyPage() {
  return <StrategyClient />;
}
