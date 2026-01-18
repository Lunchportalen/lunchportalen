// app/api/onboarding/complete/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateAgreementPdf } from "@/lib/pdf/generateAgreementPdf";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type PlanTier = "BASIS" | "LUXUS";
type DayPlan = { enabled: boolean; tier: PlanTier; priceExVat: number };

type TermsPayload = {
  version: string;
  updatedAt: string;
  accepted: boolean;
  acceptedAt: string;
  creditConsent: boolean;
  creditConsentAt: string;
  creditCheckSystem: string; // Tripletex
  billingPricesIncludeVat: boolean;
  bindingMonths: number;
  noticeMonths: number;
};

type CompletePayload = {
  companyName: string;
  orgnr: string;
  adminPhone: string;

  locationName: string;
  address: string;
  postalCode: string;
  city: string;

  delivery: {
    where: string;
    whenNote: string;
    contactName: string;
    contactPhone: string;
    windowFrom: string;
    windowTo: string;
  };

  agreement: {
    days: Record<DayKey, DayPlan>;
    billingPricesIncludeVat?: boolean;
  };

  terms: TermsPayload;
};

function isValidTimeHHMM(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function cleanISO(v: unknown): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

function normalizeOrgnr(v: string) {
  return v.replace(/\s+/g, "").trim();
}

export async function POST(req: Request) {
  const rid = `onboarding_complete_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    const body = (await req.json().catch(() => null)) as Partial<CompletePayload> | null;

    const companyName = cleanStr(body?.companyName);
    const orgnrRaw = cleanStr(body?.orgnr);
    const adminPhone = cleanStr(body?.adminPhone);

    const locationName = cleanStr(body?.locationName);
    const address = cleanStr(body?.address);
    const postalCode = cleanStr(body?.postalCode);
    const city = cleanStr(body?.city);

    const delivery = body?.delivery;
    const agreement = body?.agreement;
    const terms = body?.terms;

    // --- Validering ---
    if (!companyName || !orgnrRaw) {
      return NextResponse.json({ ok: false, rid, error: "Firmanavn og org.nr er obligatorisk." }, { status: 400 });
    }

    const orgnr = normalizeOrgnr(orgnrRaw);
    if (!/^\d{9}$/.test(orgnr)) {
      return NextResponse.json({ ok: false, rid, error: "Org.nr må være 9 siffer." }, { status: 400 });
    }

    if (!adminPhone) {
      return NextResponse.json({ ok: false, rid, error: "Firma-admin telefon er obligatorisk." }, { status: 400 });
    }

    if (!locationName || !address || !postalCode || !city) {
      return NextResponse.json({ ok: false, rid, error: "Leveringsadresse er ikke komplett." }, { status: 400 });
    }

    if (
      !delivery ||
      !cleanStr(delivery.where) ||
      !cleanStr(delivery.whenNote) ||
      !cleanStr(delivery.contactName) ||
      !cleanStr(delivery.contactPhone) ||
      !cleanStr(delivery.windowFrom) ||
      !cleanStr(delivery.windowTo)
    ) {
      return NextResponse.json(
        { ok: false, rid, error: "Leveringsinfo mangler (leveringspunkt, instruksjon, kontakt, telefon, vindu)." },
        { status: 400 }
      );
    }

    const windowFrom = cleanStr(delivery.windowFrom)!;
    const windowTo = cleanStr(delivery.windowTo)!;

    if (!isValidTimeHHMM(windowFrom) || !isValidTimeHHMM(windowTo)) {
      return NextResponse.json(
        { ok: false, rid, error: "Leveringsvindu må være på format HH:MM (f.eks. 08:30)." },
        { status: 400 }
      );
    }

    if (!agreement?.days) {
      return NextResponse.json({ ok: false, rid, error: "Avtale mangler (valg per dag)." }, { status: 400 });
    }

    const enabledDays = Object.values(agreement.days || {}).filter((d) => d?.enabled);
    if (enabledDays.length === 0) {
      return NextResponse.json({ ok: false, rid, error: "Minst én dag må være aktiv i avtalen." }, { status: 400 });
    }

    if (!terms) {
      return NextResponse.json(
        { ok: false, rid, error: "Du må akseptere avtalevilkår og samtykke til kredittvurdering." },
        { status: 400 }
      );
    }

    const termsVersion = cleanStr(terms.version);
    const termsUpdatedAt = cleanISO(terms.updatedAt);
    const acceptedAt = cleanISO(terms.acceptedAt);
    const creditConsentAt = cleanISO(terms.creditConsentAt);

    if (!terms.accepted || !terms.creditConsent || !termsVersion || !termsUpdatedAt || !acceptedAt || !creditConsentAt) {
      return NextResponse.json(
        { ok: false, rid, error: "Du må akseptere avtalevilkår og samtykke til kredittvurdering." },
        { status: 400 }
      );
    }

    // --- 1) Verifiser bruker via session ---
    const supa = await supabaseServer();
    const { data: auth, error: authErr } = await supa.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json(
        { ok: false, rid, error: "Du må være innlogget for å fullføre registreringen." },
        { status: 401 }
      );
    }

    const user = auth.user;
    const userId = user.id;
    const adminName =
      typeof (user.user_metadata as any)?.name === "string" ? ((user.user_metadata as any).name as string) : null;
    const adminEmail = user.email || null;

    // --- 2) Service role ---
    const admin = supabaseAdmin();

    // Guardrail: ikke opprett nytt firma hvis profil allerede knyttet
    const { data: existingProfile, error: existingErr } = await (admin as any)
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { ok: false, rid, error: "Kunne ikke verifisere eksisterende profil.", detail: existingErr.message },
        { status: 500 }
      );
    }
    if (existingProfile?.company_id) {
      return NextResponse.json(
        { ok: false, rid, error: "Denne brukeren er allerede knyttet til et firma." },
        { status: 409 }
      );
    }

    // --- 3) Opprett company (agreement_json inkl terms) ---
    const agreementJson = {
      ...agreement,
      billingPricesIncludeVat: true,
      terms: {
        ...terms,
        version: termsVersion,
        updatedAt: termsUpdatedAt,
        acceptedAt,
        creditConsentAt,
        billingPricesIncludeVat: true,
        creditCheckSystem: "Tripletex",
      },
    };

    const { data: company, error: companyErr } = await (admin as any)
      .from("companies")
      .insert({
        name: companyName,
        orgnr,
        plan_tier: "MIXED",
        status: "ACTIVE",
        agreement_json: agreementJson,
      })
      .select("*")
      .single();

    if (companyErr || !company?.id) {
      return NextResponse.json(
        { ok: false, rid, error: "Kunne ikke opprette firma.", detail: companyErr?.message },
        { status: 500 }
      );
    }

    // --- 4) Opprett lokasjon ---
    const deliveryJson = {
      where: cleanStr(delivery.where) ?? "",
      whenNote: cleanStr(delivery.whenNote) ?? "",
      contactName: cleanStr(delivery.contactName) ?? "",
      contactPhone: cleanStr(delivery.contactPhone) ?? "",
      windowFrom,
      windowTo,
    };

    const { data: location, error: locErr } = await (admin as any)
      .from("company_locations")
      .insert({
        company_id: company.id,
        name: locationName,
        address,
        postal_code: postalCode,
        city,
        delivery_json: deliveryJson,
      })
      .select("*")
      .single();

    if (locErr || !location?.id) {
      return NextResponse.json(
        { ok: false, rid, error: "Firma opprettet, men lokasjon feilet.", detail: locErr?.message },
        { status: 500 }
      );
    }

    // --- 5) Opprett profil (uten email-kolonne) ---
    const { error: profileErr } = await (admin as any)
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          role: "company_admin",
          company_id: company.id,
          location_id: location.id,
          name: adminName,
          phone: adminPhone,
        },
        { onConflict: "user_id" }
      );

    if (profileErr) {
      return NextResponse.json(
        { ok: false, rid, error: "Firma opprettet, men profilen kunne ikke lagres.", detail: profileErr.message },
        { status: 500 }
      );
    }

    // --- 6) FULL PDF -> Storage ---
    const pdfBytes = await generateAgreementPdf({
      companyName,
      orgnr,
      adminName,
      adminEmail,
      adminPhone,

      locationName,
      address,
      postalCode,
      city,

      delivery: {
        where: deliveryJson.where,
        whenNote: deliveryJson.whenNote,
        contactName: deliveryJson.contactName,
        contactPhone: deliveryJson.contactPhone,
        windowFrom,
        windowTo,
      },

      days: agreement.days,

      terms: {
        ...terms,
        version: termsVersion,
        updatedAt: termsUpdatedAt,
        acceptedAt,
        creditConsentAt,
        creditCheckSystem: "Tripletex",
        billingPricesIncludeVat: true,
      },
    });

    const pdfPath = `agreements/${company.id}/agreement-${termsVersion}.pdf`;

    const upload = await admin.storage
      .from("agreements")
      .upload(pdfPath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upload.error) {
      return NextResponse.json(
        { ok: false, rid, error: "Firma opprettet, men avtale-PDF kunne ikke lagres.", detail: upload.error.message },
        { status: 500 }
      );
    }

    // --- 7) Oppdater agreement_json med pdf metadata ---
    const { error: updErr } = await (admin as any)
      .from("companies")
      .update({
        agreement_json: {
          ...agreementJson,
          terms: {
            ...agreementJson.terms,
            pdfPath,
            pdfVersion: termsVersion,
            signedAt: acceptedAt,
          },
        },
      })
      .eq("id", company.id);

    if (updErr) {
      return NextResponse.json(
        { ok: false, rid, error: "Firma opprettet, men kunne ikke lagre PDF-metadata.", detail: updErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, rid, companyId: company.id, locationId: location.id, pdfPath });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, rid, error: "Serverfeil ved registrering.", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
