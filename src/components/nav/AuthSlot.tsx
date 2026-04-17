// STATUS: KEEP

import Link from "next/link";
import { getScope, ScopeError } from "@/lib/auth/scope";

export default async function AuthSlot() {
  try {
    const scope = await getScope({} as any);

    const email = (scope as any)?.email || (scope as any)?.user?.email || "";
    return (
      <div className="flex items-center gap-2">
        <span className="lp-chip lp-chip-neutral">{email ? email : "Innlogget"}</span>
        <Link href="/logout" className="lp-btn lp-btn--secondary lp-btn--sm">
          Logg ut
        </Link>
      </div>
    );
  } catch (e: any) {
    return (
      <div className="flex items-center gap-2">
        <span className="lp-chip lp-chip-neutral">Ikke innlogget</span>
        <Link href="/login" className="lp-btn lp-btn--secondary lp-btn--sm">
          Til login
        </Link>
      </div>
    );
  }
}
