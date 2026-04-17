// app/(public)/kontakt/KontaktClient.tsx
"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORT_EMAIL } from "@/lib/system/emails";

/* =========================================================
   Types
========================================================= */

type Status =
  | { type: "idle" }
  | { type: "sending"; rid: string }
  | { type: "ok"; rid: string; leadId?: string; /** false når API lagret lead men SMTP feilet */ emailDelivered?: boolean }
  | { type: "error"; message: string; rid?: string };

/* =========================================================
   Utils
========================================================= */

function makeRid() {
  const a = Math.random().toString(16).slice(2, 8);
  const b = Date.now().toString(16).slice(-6);
  return `rid_${b}${a}`;
}

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/* =========================================================
   Page
========================================================= */

export type KontaktClientProps = {
  /** Når true, skjules sidetittel/ingress (brukes når H1 kommer fra CMS-wrapper). */
  hidePageHeader?: boolean;
};

export default function KontaktPage({ hidePageHeader = false }: KontaktClientProps) {
  const searchParams = useSearchParams();
  /** Støtter `?postId=` (redirect fra SoMe) og `?post_id=` for bakoverkompatibilitet. */
  const socialPostId =
    searchParams.get("postId")?.trim() ?? searchParams.get("post_id")?.trim() ?? "";

  const [status, setStatus] = useState<Status>({ type: "idle" });

  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    subject: "",
    message: "",
  });

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Skriv inn navn.";
    if (!form.email.trim()) e.email = "Skriv inn e-post.";
    else if (!isEmail(form.email)) e.email = "Ugyldig e-postadresse.";
    if (!form.subject.trim()) e.subject = "Skriv inn emne.";
    if (!form.message.trim()) e.message = "Skriv inn melding.";
    if (form.message.trim().length > 5000) e.message = "Meldingen er for lang (maks 5000 tegn).";
    return e;
  }, [form]);

  const canSend = Object.keys(errors).length === 0 && status.type !== "sending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSend) {
      setStatus({
        type: "error",
        message: "Sjekk feltene og prøv igjen.",
      });
      return;
    }

    const rid = makeRid();
    setStatus({ type: "sending", rid });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-rid": rid,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim() || null,
          phone: form.phone.trim() || null,
          subject: form.subject.trim(),
          message: form.message.trim(),
          rid,
          ...(socialPostId ? { postId: socialPostId } : {}),
        }),
      });

      const text = await res.text();
      let data: any = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { _raw: text };
      }

      if (!res.ok) {
        const base =
          safeStr(data?.message) ||
          safeStr((data as { error?: unknown })?.error) ||
          `Kunne ikke sende meldingen (HTTP ${res.status}).`;
        const detail = safeStr((data as { detail?: unknown })?.detail);
        setStatus({
          type: "error",
          message: detail ? `${base} (${detail})` : base,
          rid: safeStr(data?.rid) || rid,
        });
        return;
      }

      const payload = (data as { data?: { leadId?: unknown; emailSent?: unknown } })?.data;
      const leadId = safeStr(payload?.leadId) || undefined;
      const emailSent =
        payload && typeof payload === "object" && "emailSent" in payload && typeof (payload as { emailSent?: unknown }).emailSent === "boolean"
          ? (payload as { emailSent: boolean }).emailSent
          : undefined;

      setStatus({
        type: "ok",
        rid: safeStr(data?.rid) || rid,
        ...(leadId ? { leadId } : {}),
        ...(emailSent === false ? { emailDelivered: false } : {}),
      });

      if (socialPostId) {
        void fetch("/api/social/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postId: socialPostId, type: "lead" }),
        }).catch(() => {});
        void fetch("/api/revenue/lead", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postId: socialPostId, meta: { source: "kontakt_form" } }),
        }).catch(() => {});
      }

      setForm({
        name: "",
        email: "",
        company: "",
        phone: "",
        subject: "",
        message: "",
      });
    } catch (err: any) {
      setStatus({
        type: "error",
        message: safeStr(err?.message) || "Noe gikk galt. Prøv igjen om litt.",
        rid,
      });
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-white">
      {/* Subtle tech glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 420px at 18% 10%, rgba(255,0,127,.08), transparent 60%), radial-gradient(820px 380px at 86% 0%, rgba(99,102,241,.08), transparent 60%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-7 sm:py-9 min-h-[70vh]">
        {!hidePageHeader ? (
          <div className="mb-5">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Kontakt oss</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Send en melding, så følger vi opp så raskt vi kan.
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {/* LEFT INFO */}
          <aside className="space-y-5 lg:col-span-1">
            <div className="lp-glass-card rounded-card p-4">
              <h2 className="text-sm font-semibold">Kontaktinformasjon</h2>

              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">E-post</div>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="lp-motion-btn font-medium hover:text-[#ff007f]">
                    {SUPPORT_EMAIL}
                  </a>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Telefon</div>
                  <a href="tel:+4748155481" className="lp-motion-btn font-medium hover:text-[#ff007f]">
                    481 55 481
                  </a>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Selskap</div>
                  <div className="font-medium">LUNCHPORTALEN AS</div>
                  <div className="mt-1 text-muted-foreground">Org.nr: 937 155 239</div>
                  <div className="mt-1 text-muted-foreground">
                    Lykkmarka 27
                    <br />
                    7081 SJETNEMARKA
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Kundeside</div>
                  <Link href="/login" className="lp-motion-btn font-medium hover:text-[#ff007f]">
                    Logg inn
                  </Link>
                </div>
              </div>
            </div>

            <div className="lp-glass-card rounded-card p-4">
              <div className="text-xs font-semibold text-muted-foreground">Tips for raskere hjelp</div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Oppgi gjerne tidspunkt og hvilken side du var på.</li>
                <li>• Hvis du får RID-kvittering, legg den ved.</li>
                <li>• Ikke del passord eller sensitive opplysninger.</li>
              </ul>
            </div>
          </aside>

          {/* FORM */}
          <section className="lg:col-span-2">
            <div className="lp-glass-card rounded-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Send melding</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Du får en RID-kvittering ved innsending.</p>
                </div>
                <span
                  className="mt-1 inline-flex h-3 w-3 rounded-full"
                  style={{ background: "#ff007f", boxShadow: "0 0 16px rgba(255,0,127,.45)" }}
                  aria-hidden="true"
                />
              </div>

              <form onSubmit={onSubmit} className="mt-5 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Navn</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                      placeholder="Skriv inn navn"
                      className="rounded-xl focus-visible:ring-[#ff007f]"
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-post</Label>
                    <Input
                      id="email"
                      value={form.email}
                      onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                      placeholder="Skriv inn e-post"
                      className="rounded-xl focus-visible:ring-[#ff007f]"
                      inputMode="email"
                      autoComplete="email"
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company">Bedrift (valgfritt)</Label>
                    <Input
                      id="company"
                      value={form.company}
                      onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))}
                      placeholder="Firmanavn"
                      className="rounded-xl focus-visible:ring-[#ff007f]"
                      autoComplete="organization"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon (valgfritt)</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                      placeholder="+47 …"
                      className="rounded-xl focus-visible:ring-[#ff007f]"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Emne</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))}
                    placeholder="Hva gjelder det?"
                    className="rounded-xl focus-visible:ring-[#ff007f]"
                  />
                  {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Melding</Label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
                    placeholder="Skriv kort og konkret (ikke passord)."
                    className="min-h-[170px] rounded-xl focus-visible:ring-[#ff007f]"
                  />
                  <div className="flex items-center justify-between">
                    {errors.message ? (
                      <p className="text-xs text-destructive">{errors.message}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{form.message.trim().length}/5000 tegn</p>
                    )}
                    {status.type === "sending" ? (
                      <p className="text-xs text-muted-foreground">
                        Sender… <span className="font-mono">{status.rid}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                {status.type === "ok" && (
                  <div
                    className="rounded-xl border px-4 py-3 text-sm"
                    style={{ borderColor: "#ff007f", boxShadow: "0 0 18px rgba(255,0,127,.14)" }}
                  >
                    <div className="font-medium">Meldingen er sendt.</div>
                    {status.emailDelivered === false ? (
                      <div className="mt-2 text-muted-foreground">
                        Vi kunne ikke bekrefte e-postvarsling til oss akkurat nå, men henvendelsen er registrert. Ved hast,
                        kontakt {SUPPORT_EMAIL} og oppgi RID under.
                      </div>
                    ) : null}
                    <div className="mt-1 text-muted-foreground">
                      RID: <span className="font-mono text-foreground">{status.rid}</span>
                    </div>
                    {status.leadId ? (
                      <div className="mt-1 text-muted-foreground">
                        Lead: <span className="font-mono text-foreground">{status.leadId}</span>
                      </div>
                    ) : null}
                  </div>
                )}

                {status.type === "error" && (
                  <div className="rounded-xl border border-destructive bg-destructive/5 px-4 py-3 text-sm">
                    <div className="font-medium text-destructive">Kunne ikke sende meldingen</div>
                    <div className="mt-1 text-muted-foreground">{status.message}</div>
                    {status.rid && (
                      <div className="mt-2 text-muted-foreground">
                        RID: <span className="font-mono text-foreground">{status.rid}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="submit"
                    disabled={!canSend}
                    className="lp-motion-btn rounded-xl px-8 text-white"
                    style={{ background: "#ff007f", boxShadow: "0 12px 35px rgba(255,0,127,.22)" }}
                  >
                    {status.type === "sending" ? "Sender…" : "Send melding"}
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Raskt:</span>{" "}
                    <a className="lp-motion-btn hover:text-[#ff007f]" href={`mailto:${SUPPORT_EMAIL}`}>
                      {SUPPORT_EMAIL}
                    </a>
                    {" · "}
                    <a className="lp-motion-btn hover:text-[#ff007f]" href="tel:+4748155481">
                      481 55 481
                    </a>
                  </div>
                </div>
              </form>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <div className="text-xs font-semibold text-muted-foreground">Slik bruker vi RID</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Når du sender inn får du en RID-kvittering. Oppgi den hvis du følger opp, så finner vi saken raskt.
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-4">
                  <div className="text-xs font-semibold text-muted-foreground">Typiske henvendelser</div>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Tilgang / innlogging</li>
                    <li>• Faktura / avtale</li>
                    <li>• Levering / endring</li>
                    <li>• Teknisk feil (legg ved tidspunkt)</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-5 lp-glass-card rounded-card p-5">
              <h3 className="text-base font-semibold">Ofte stilte spørsmål</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-medium">Når får vi svar?</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Normalt i arbeidstid. Ved hast: ring 481 55 481 eller send e-post.
                  </p>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-medium">Hva trenger dere ved feil?</div>
                  <p className="mt-1 text-sm text-muted-foreground">Side/URL, tidspunkt, hva du gjorde, og RID hvis du har den.</p>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-medium">Kan jeg sende sensitive data?</div>
                  <p className="mt-1 text-sm text-muted-foreground">Nei. Ikke send passord eller unødvendige personopplysninger.</p>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-medium">Hvorfor må vi ha emne?</div>
                  <p className="mt-1 text-sm text-muted-foreground">Det gir raskere routing internt og kortere svartid.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
