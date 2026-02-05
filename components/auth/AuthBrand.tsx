import Image from "next/image";
import { ADMIN_LOGO_SRC } from "@/lib/admin/constants";

export default function AuthBrand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80">
        <Image src={ADMIN_LOGO_SRC} alt="Lunchportalen" width={28} height={28} className="h-7 w-7" priority />
      </div>
      <div>
        <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">Lunchportalen</div>
        <div className="text-xs text-[rgb(var(--lp-muted))]">Enterprise Access</div>
      </div>
    </div>
  );
}
