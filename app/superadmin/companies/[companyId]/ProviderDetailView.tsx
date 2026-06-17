import type { SuperadminProviderDetail } from "@/lib/server/superadmin/loadSuperadminProviderDetail";

import ProviderDetailClient from "./ProviderDetailClient";

export default function ProviderDetailView(props: { data: SuperadminProviderDetail }) {
  return <ProviderDetailClient data={props.data} />;
}
