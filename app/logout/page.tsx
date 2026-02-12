export const dynamic = "force-dynamic";
export const revalidate = 0;

import AuthShell from "@/components/auth/AuthShell";
import LogoutClient from "@/components/auth/LogoutClient";

export default function LogoutPage() {
  return (
    <AuthShell title="Logger ut" subtitle="Sikrer at økten avsluttes trygt.">
      <LogoutClient />
    </AuthShell>
  );
}
