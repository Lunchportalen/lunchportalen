import ExperimentsClient from "./ExperimentsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SuperadminExperimentsPage() {
  return <ExperimentsClient />;
}
