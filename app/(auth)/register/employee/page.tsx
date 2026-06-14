import type { Metadata } from "next";

import RegisterEmployeeInviteStateCard from "./RegisterEmployeeInviteStateCard";
import {
  EMPLOYEE_ACTIVATION_NEXT_STEPS,
  EMPLOYEE_ACTIVATION_PAGE_EYEBROW,
  EMPLOYEE_ACTIVATION_PAGE_TITLE,
  EMPLOYEE_ACTIVATION_ROLE_LABEL,
  EMPLOYEE_ACTIVATION_SECURITY_NOTE_PAGE,
  EMPLOYEE_ACTIVATION_STATUS_BADGE,
  EMPLOYEE_INVITE_UNAVAILABLE_COPY,
  EMPLOYEE_INVITE_UNAVAILABLE_TITLE,
  employeeActivationPageLead,
  employeeActivationStatusSub,
} from "@/lib/onboarding/employeeActivationCopy";
import { resolveEmployeeInviteContext } from "@/lib/invites/resolveEmployeeInviteContext";

import RegisterEmployeeClient from "./RegisterEmployeeClient";

export const metadata: Metadata = {
  title: "Opprett ansattkonto – Lunchportalen",
  description: "Fullfør invitasjon og opprett ansattkonto for firmalunsj.",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(sp: Record<string, unknown> | undefined, key: string): string | null {
  const v = sp?.[key];
  if (!v) return null;
  if (Array.isArray(v)) return String(v[0] ?? "");
  return String(v);
}

export default async function RegisterEmployeePage(props: PageProps) {
  const sp = (await props.searchParams) ?? {};
  const token = getParam(sp, "token");

  if (!token) {
    return (
      <RegisterEmployeeInviteStateCard
        title="Lenken mangler"
        text="Be administrator sende deg en ny ansattinvitasjon."
        showLoginLink={false}
      />
    );
  }

  const ctx = await resolveEmployeeInviteContext(token);
  if (!ctx.ok) {
    return (
      <RegisterEmployeeInviteStateCard
        title={EMPLOYEE_INVITE_UNAVAILABLE_TITLE}
        text={EMPLOYEE_INVITE_UNAVAILABLE_COPY}
      />
    );
  }

  const { email, companyName, providerName, locationName } = ctx;

  return (
    <main className="relative min-h-screen w-full overflow-clip bg-[rgb(var(--lp-bg))] px-4 py-8 text-[rgb(var(--lp-text))] md:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 520px at 50% 0%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.00) 60%), radial-gradient(700px 420px at 18% 18%, rgba(245,197,24,0.10) 0%, rgba(245,197,24,0.00) 55%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[1040px]">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <section className="rounded-3xl border border-[rgba(36,32,25,0.12)] bg-[#242019] p-6 text-white shadow-[0_24px_80px_rgba(26,23,20,0.28)] md:p-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#f5c842]/25 bg-[#f5c842]/10 px-3 py-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#f5c842]">
                &#10003; {EMPLOYEE_ACTIVATION_STATUS_BADGE}
              </span>
              <span className="text-xs text-[#d8c8a8]">{employeeActivationStatusSub(companyName)}</span>
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-[#f5c842]/80">
              {EMPLOYEE_ACTIVATION_PAGE_EYEBROW}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">{EMPLOYEE_ACTIVATION_PAGE_TITLE}</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#d8c8a8] md:text-base">{employeeActivationPageLead(companyName)}</p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#f5c842]">Oppsummering</p>
              <dl className="mt-4 space-y-3 text-sm">
                {companyName ? (
                  <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3">
                    <dt className="text-[#8f7f66]">Bedrift</dt>
                    <dd className="font-semibold text-white">{companyName}</dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3">
                  <dt className="text-[#8f7f66]">Rolle</dt>
                  <dd className="font-semibold text-white">{EMPLOYEE_ACTIVATION_ROLE_LABEL}</dd>
                </div>
                {providerName ? (
                  <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3">
                    <dt className="text-[#8f7f66]">Leverandør</dt>
                    <dd className="font-semibold text-white">{providerName}</dd>
                  </div>
                ) : null}
                {locationName ? (
                  <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3">
                    <dt className="text-[#8f7f66]">Lokasjon</dt>
                    <dd className="font-semibold text-white">{locationName}</dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#8f7f66]">Neste steg</dt>
                  <dd className="font-semibold text-white">Opprett konto</dd>
                </div>
              </dl>
            </div>

            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#f5c842]">Neste steg</p>
              <ol className="mt-4 space-y-3">
                {EMPLOYEE_ACTIVATION_NEXT_STEPS.map((step, index) => (
                  <li key={step} className="flex items-start gap-3 text-sm leading-6 text-[#d8c8a8]">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f5c842]/15 text-xs font-bold text-[#f5c842]">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-8 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm leading-6 text-[#c8b99a]">
              {EMPLOYEE_ACTIVATION_SECURITY_NOTE_PAGE}
            </p>
          </section>

          <section className="rounded-3xl border border-[rgba(var(--lp-border),0.55)] bg-white/90 p-6 shadow-[var(--lp-shadow-card)] backdrop-blur-sm md:p-8">
            <RegisterEmployeeClient token={token} email={email} />
          </section>
        </div>
      </div>
    </main>
  );
}
