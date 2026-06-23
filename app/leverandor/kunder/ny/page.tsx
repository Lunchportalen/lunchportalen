// app/leverandor/kunder/ny/page.tsx — skeleton (Patch 13)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function LeverandorNyKundePage() {
  const t = await getTranslations("provider.customers.create");

  return (
    <div className="ds-container">
      <h1 className="ds-h2">{t("heading")}</h1>
      <p className="ds-lead">{t("lead")}</p>
      <Link href="/leverandor/kunder" className="ds-btn ds-btn--secondary">
        {t("backToCustomers")}
      </Link>
    </div>
  );
}
