import Image from "next/image";
import { ADMIN_LOGO_SRC } from "@/lib/admin/constants";

type AuthBrandProps = {
  subtitle?: string;
  centered?: boolean;
};

export default function AuthBrand({ subtitle = "Enterprise Access", centered = false }: AuthBrandProps) {
  return (
    <div className={`flex items-center gap-3 ${centered ? "justify-center sm:justify-start" : ""}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/85 shadow-[var(--lp-shadow-sm)]">
        <Image src={ADMIN_LOGO_SRC} alt="Lunchportalen" width={30} height={30} className="h-8 w-8" priority />
      </div>
      <div>
        <div className="text-sm font-extrabold tracking-tight text-[rgb(var(--lp-text))]">Lunchportalen</div>
        <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{subtitle}</div>
      </div>
    </div>
  );
}
