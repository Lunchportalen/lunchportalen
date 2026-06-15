import Link from "next/link";

import {
  EMPLOYEE_ACTIVATION_STATUS_LABEL,
  EMPLOYEE_INVITE_UNAVAILABLE_COPY,
  EMPLOYEE_INVITE_UNAVAILABLE_TITLE,
} from "@/lib/onboarding/employeeActivationCopy";

type Props = {
  title?: string;
  text?: string;
  showLoginLink?: boolean;
};

export default function RegisterEmployeeInviteStateCard({
  title = EMPLOYEE_INVITE_UNAVAILABLE_TITLE,
  text = EMPLOYEE_INVITE_UNAVAILABLE_COPY,
  showLoginLink = true,
}: Props) {
  return (
    <main className="relative min-h-screen w-full overflow-clip bg-[rgb(var(--lp-bg))] px-4 py-10 text-[rgb(var(--lp-text))]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 520px at 50% 0%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.00) 60%), radial-gradient(700px 420px at 18% 18%, rgba(245,197,24,0.10) 0%, rgba(245,197,24,0.00) 55%)",
        }}
      />
      <div className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-2xl items-center justify-center">
        <section className="w-full rounded-3xl border border-[rgba(36,32,25,0.12)] bg-[#242019] p-8 text-white shadow-[0_24px_80px_rgba(26,23,20,0.28)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f5c842]/80">{EMPLOYEE_ACTIVATION_STATUS_LABEL}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1>
          <p className="mt-4 text-sm leading-7 text-[#d8c8a8]">{text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {showLoginLink ? (
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center rounded-full bg-[#f5c842] px-5 text-sm font-semibold text-[#1a1714] hover:opacity-95"
              >
                Gå til innlogging
              </Link>
            ) : null}
            <Link
              href="/kontakt"
              className="inline-flex min-h-[44px] items-center rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Kontakt oss
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
