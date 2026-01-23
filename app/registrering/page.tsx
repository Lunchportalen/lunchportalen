// app/register/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ApiOk = {
  ok: true;
  companyId?: string;
  locationId?: string;
  adminUserId?: string;
  message?: string;
};

type ApiErr = {
  ok: false;
  error: string;
  message?: string;
  detail?: any;
};

type ApiRes = ApiOk | ApiErr;

function onlyDigits(v: string) {
  return String(v ?? "").replace(/\D/g, "");
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function safeText(v: string) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function passwordOk(pw: string) {
  return typeof pw === "string" && pw.length >= 8;
}

type GateChoice = "admin" | "employee" | null;

function pickApiMessage(data: any, fallback: string) {
  return (
    (data && typeof data.message === "string" && data.message) ||
    (data && typeof data.error === "string" && data.error) ||
    fallback
  );
}

export default function RegistreringPage() {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // ✅ Gate: tving bruker til å velge "admin" eller "ansatt"
  const [choice, setChoice] = useState<GateChoice>(null);

  // ✅ Obligatorisk bekreftelse
  const [confirmAdmin, setConfirmAdmin] = useState(false);

  // Firma
  const [companyName, setCompanyName] = useState("");
  const [orgnr, setOrgnr] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");

  // Firma-admin
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  // Levering (lokasjon)
  const [locationName, setLocationName] = useState("Hovedkontor");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  const employeeCountNum = useMemo(() => {
    const n = Number(onlyDigits(employeeCount));
    return Number.isFinite(n) ? n : 0;
  }, [employeeCount]);

  const canSubmit = useMemo(() => {
    // ✅ Må eksplisitt ha valgt admin + bekreftet
    if (choice !== "admin") return false;
    if (!confirmAdmin) return false;

    if (!safeText(companyName)) return false;
    if (onlyDigits(orgnr).length !== 9) return false;
    if (employeeCountNum < 20) return false;

    if (!safeText(adminName)) return false;
    if (!isEmail(safeText(adminEmail).toLowerCase())) return false;
    if (onlyDigits(adminPhone).length < 8) return false;

    if (!passwordOk(password)) return false;
    if (password !== password2) return false;

    if (!safeText(locationName)) return false;
    if (!safeText(address)) return false;
    if (onlyDigits(postalCode).length !== 4) return false;
    if (!safeText(city)) return false;

    return true;
  }, [
    choice,
    confirmAdmin,
    companyName,
    orgnr,
    employeeCountNum,
    adminName,
    adminEmail,
    adminPhone,
    password,
    password2,
    locationName,
    address,
    postalCode,
    city,
  ]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);

    if (choice !== "admin") {
      return setErr(
        "Denne registreringen er kun for firma-admin. Ansatte skal logge inn og/eller vente på invitasjon."
      );
    }
    if (!confirmAdmin) {
      return setErr("Du må bekrefte at du er firmaets administrator og har fullmakt til å registrere bedriften.");
    }

    // Frontend-validering (tydelig, men enkel)
    const org = onlyDigits(orgnr);
    const phone = onlyDigits(adminPhone);
    const post = onlyDigits(postalCode);
    const email = safeText(adminEmail).toLowerCase();

    if (!safeText(companyName)) return setErr("Fyll inn firmanavn.");
    if (org.length !== 9) return setErr("Org.nr må være 9 siffer.");
    if (employeeCountNum < 20) return setErr("Minimum 20 ansatte for å registrere firma.");
    if (!safeText(adminName)) return setErr("Fyll inn navn på firma-admin.");
    if (!isEmail(email)) return setErr("Ugyldig e-postadresse.");
    if (phone.length < 8) return setErr("Telefonnummer må ha minst 8 siffer.");
    if (!passwordOk(password)) return setErr("Passord må være minimum 8 tegn.");
    if (password !== password2) return setErr("Passordene er ikke like.");
    if (!safeText(locationName)) return setErr("Fyll inn leveringspunkt.");
    if (!safeText(address)) return setErr("Fyll inn adresse.");
    if (post.length !== 4) return setErr("Postnummer må være 4 siffer.");
    if (!safeText(city)) return setErr("Fyll inn poststed.");

    setSubmitting(true);
    try {
      const payload = {
        company: {
          name: safeText(companyName),
          orgnr: org,
          employeeCount: employeeCountNum,
        },
        admin: {
          name: safeText(adminName),
          email,
          phone,
          password,
        },
        location: {
          name: safeText(locationName),
          address: safeText(address),
          postalCode: post,
          city: safeText(city),
        },
      };

      const r = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const data = (await r.json().catch(() => null)) as ApiRes | null;

      if (!r.ok || !data || data.ok === false) {
        const msg = pickApiMessage(data, `HTTP ${r.status}`);
        throw new Error(String(msg));
      }

      setOkMsg(data.message || "Registrering mottatt. Du kan nå logge inn som firma-admin.");

      // Trygg flyt: login → middleware sender til /admin for company_admin
      router.push("/login?next=/admin");
    } catch (e: any) {
      setErr(e?.message || "Kunne ikke registrere firma. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-3xl bg-white/70 p-8 ring-1 ring-[rgb(var(--lp-border))]">
        <h1 className="text-3xl font-semibold tracking-tight">
          Registrer bedrift{" "}
          <span className="text-[rgb(var(--lp-muted))]">(kun firma-admin)</span>
        </h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Opprett firmakonto og firma-administrator. Avtalen aktiveres etter gjennomgang.{" "}
          <strong>Ansatte skal ikke registrere seg her</strong> – de får invitasjon fra firmaets admin.
        </p>

        {/* ✅ Gate: tving valg før skjema */}
        <div className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Start her</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setErr(null);
                setOkMsg(null);
                setChoice("admin");
              }}
              className={[
                "rounded-2xl px-4 py-3 text-left ring-1 transition",
                choice === "admin"
                  ? "bg-black text-white ring-black"
                  : "bg-white text-[rgb(var(--lp-text))] ring-[rgb(var(--lp-border))] hover:bg-white/80",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">Jeg er firma-admin</div>
              <div className="mt-1 text-xs opacity-80">
                Jeg registrerer bedriften og blir administrator i Lunchportalen.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                // ✅ Sikkerhet: send ansatte til login, ikke la dem “falle inn” i skjema
                router.push("/login");
              }}
              className="rounded-2xl bg-white px-4 py-3 text-left text-[rgb(var(--lp-text))] ring-1 ring-[rgb(var(--lp-border))] transition hover:bg-white/80"
            >
              <div className="text-sm font-semibold">Jeg er ansatt</div>
              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                Jeg skal logge inn / vente på invitasjon fra leder.
              </div>
            </button>
          </div>

          {choice !== "admin" ? (
            <div className="mt-4 rounded-2xl bg-[rgb(var(--lp-bg))] px-4 py-3 text-sm text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]">
              For å registrere bedrift må du være <strong>firmaets admin</strong>. Er du ansatt, gå til innlogging.
            </div>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Slik fungerer det</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[rgb(var(--lp-muted))]">
            <li>Du registrerer bedrift og firma-admin.</li>
            <li>Vi gjennomgår forespørselen.</li>
            <li>Avtalen aktiveres av superadmin.</li>
            <li>Firma-admin inviterer ansatte når løsningen tas i bruk.</li>
          </ol>
        </div>

        {/* Skjemaet vises kun når admin er valgt */}
        {choice === "admin" ? (
          <form onSubmit={onSubmit} className="mt-8 space-y-8">
            {/* Firma */}
            <section className="rounded-3xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
              <h2 className="text-base font-semibold">Firma</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Firmanavn *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="F.eks. Eksempel AS"
                    autoComplete="organization"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Org.nr *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={orgnr}
                    onChange={(e) => setOrgnr(e.target.value)}
                    inputMode="numeric"
                    placeholder="9 siffer"
                  />
                  <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Kun siffer. 9 tegn.</div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Hvor mange ansatte? *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)}
                    inputMode="numeric"
                    placeholder="Minst 20"
                  />
                  <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                    Minimum 20 ansatte for å registrere firma i Lunchportalen.
                  </div>
                </div>
              </div>
            </section>

            {/* Firma-admin */}
            <section className="rounded-3xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
              <h2 className="text-base font-semibold">Firma-admin</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Navn *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Fornavn Etternavn"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">E-post *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="navn@firma.no"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Telefon *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="8+ siffer"
                    autoComplete="tel"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Passord *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Min. 8 tegn"
                    autoComplete="new-password"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Bekreft passord *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    type="password"
                    placeholder="Må være identisk med passordet"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </section>

            {/* Levering */}
            <section className="rounded-3xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
              <h2 className="text-base font-semibold">Levering</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Leveringspunkt *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="F.eks. Hovedkontor / Avdeling Midtbyen"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Adresse *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Gateadresse"
                    autoComplete="street-address"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Postnummer *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    inputMode="numeric"
                    placeholder="4 siffer"
                    autoComplete="postal-code"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Poststed *</label>
                  <input
                    className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="By"
                    autoComplete="address-level2"
                  />
                </div>
              </div>
            </section>

            {/* ✅ Bekreftelse – må krysses av */}
            <section className="rounded-3xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="flex items-start gap-3">
                <input
                  id="confirmAdmin"
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[rgb(var(--lp-border))]"
                  checked={confirmAdmin}
                  onChange={(e) => setConfirmAdmin(e.target.checked)}
                />
                <label htmlFor="confirmAdmin" className="text-sm">
                  <span className="font-semibold">Bekreftelse</span>
                  <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
                    Jeg bekrefter at jeg er firmaets administrator og har fullmakt til å registrere bedriften i
                    Lunchportalen. Ansatte skal inviteres av firma-admin og skal ikke registrere seg her.
                  </div>
                </label>
              </div>
            </section>

            {/* Messages */}
            {err ? (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">{err}</div>
            ) : null}

            {okMsg ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
                {okMsg}
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[rgb(var(--lp-muted))]">
                Ved innsending opprettes firma-admin. Avtalen aktiveres etter gjennomgang.
              </div>

              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className={[
                  "rounded-2xl px-5 py-3 text-sm font-medium ring-1 transition",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  "bg-black text-white ring-black hover:bg-black/90",
                ].join(" ")}
              >
                {submitting ? "Sender…" : "Send registrering"}
              </button>
            </div>

            {/* ✅ En siste “ansatt”-utgang helt nederst også */}
            <div className="pt-2 text-center text-sm text-[rgb(var(--lp-muted))]">
              Er du ansatt?{" "}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="font-medium text-[rgb(var(--lp-text))] underline underline-offset-4 hover:opacity-80"
              >
                Gå til innlogging
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
