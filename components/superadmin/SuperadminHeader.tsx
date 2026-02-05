// components/superadmin/SuperadminHeader.tsx
import LogoutButton from "@/components/auth/LogoutButton";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { SuperadminTabs } from "@/components/superadmin/SuperadminTabs";
import { SuperadminMobileMenu } from "@/components/superadmin/SuperadminMobileMenu";

export default async function SuperadminHeader() {
  const session = await getSessionUser();
  const email = session?.email ?? null;
  const pill = "rounded-full border px-3 py-1 text-sm";

  return (
    <header className="sticky top-0 z-50 border-b">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="justify-self-start">
            <div className="text-[10px] tracking-[0.22em] opacity-80">LUNCHPORTALEN</div>
            <div className="text-sm font-semibold">Superadmin</div>
          </div>

          <div className="justify-self-center">
            <div className="hidden md:inline-flex items-center gap-3">
              <SuperadminTabs />
            </div>
          </div>

          <div className="justify-self-end flex items-center gap-2">
            <SuperadminMobileMenu className="md:hidden" />
            <span className={pill}>{email ?? "Innlogget"}</span>
            <LogoutButton className={pill} />
          </div>
        </div>
      </div>
    </header>
  );
}
