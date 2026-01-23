// app/api/public/onboarding/register/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isEmail(v: any) {
  const s = String(v ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function onlyDigits(v: any) {
  return String(v ?? "").replace(/\D/g, "");
}

function cleanStr(v: any) {
  return String(v ?? "").trim();
}

type AdminUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any> | null;
};

async function findAuthUserByEmailPaged(admin: any, emailLower: string, rid: string) {
  const perPage = 200;
  let page = 1;

  for (let guard = 0; guard < 2000; guard++) {
    const res = await admin.auth.admin.listUsers({ page, perPage });
    if (res.error) return { user: null as AdminUser | null, error: res.error };

    const users = (res.data?.users ?? []) as AdminUser[];
    if (users.length === 0) return { user: null, error: null };

    const hit = users.find((u) => (u.email ?? "").toLowerCase() === emailLower);
    if (hit) return { user: hit, error: null };

    if (users.length < perPage) return { user: null, error: null };
    page += 1;
  }

  return { user: null, error: { message: `Paging guard triggered (rid=${rid})` } };
}

export async function POST(req: Request) {
  const rid = `onb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = await req.json();

    // ✅ hos deg er supabaseAdmin en FUNKSJON
    const admin = supabaseAdmin();

    // =========================
    // Input
    // =========================
    const company_name = cleanStr(body?.company_name);
    const orgnr = onlyDigits(body?.orgnr);
    const employee_count = Number(body?.employees_count); // inputfelt heter employees_count

    const admin_name = cleanStr(body?.admin_name);
    const admin_email = cleanStr(body?.admin_email).toLowerCase();
    const admin_phone = onlyDigits(body?.admin_phone);
    const password = String(body?.password ?? "");
    const password2 = String(body?.password2 ?? "");

    // =========================
    // Validation
    // =========================
    if (!company_name) return jsonError(400, "bad_request", "Firmanavn mangler.", { rid });
    if (orgnr.length !== 9) return jsonError(400, "bad_request", "Org.nr må være 9 siffer.", { rid });
    if (!Number.isFinite(employee_count) || employee_count < 20) {
      return jsonError(400, "bad_request", "Firma må ha minimum 20 ansatte.", { rid });
    }

    if (!admin_name) return jsonError(400, "bad_request", "Admin-navn mangler.", { rid });
    if (!isEmail(admin_email)) return jsonError(400, "bad_request", "Ugyldig e-postadresse.", { rid });
    if (!admin_phone) return jsonError(400, "bad_request", "Telefon mangler.", { rid });

    if (password.length < 8) return jsonError(400, "bad_request", "Passord må være minimum 8 tegn.", { rid });
    if (password !== password2) return jsonError(400, "bad_request", "Passordene matcher ikke.", { rid });

    // =========================
    // 1) Guard: unik orgnr
    // =========================
    const existingCompany = await admin.from("companies").select("id").eq("orgnr", orgnr).maybeSingle();
    if (existingCompany.data?.id) {
      return jsonError(409, "conflict", "Dette org.nr er allerede registrert.", { rid });
    }

    // =========================
    // 2) Best practice: sjekk e-post i profiles først (raskt og presist)
    // =========================
    const profByEmail = await admin
      .from("profiles")
      .select("user_id, company_id, role, email")
      .ilike("email", admin_email)
      .maybeSingle();

    if (profByEmail.error) {
      return jsonError(500, "db_error", "Kunne ikke sjekke e-post i profiler.", { rid, supabase: profByEmail.error });
    }

    // Hvis e-post finnes og allerede er knyttet til firma → stopp (enterprise-strengt)
    if (profByEmail.data?.user_id && profByEmail.data?.company_id) {
      return jsonError(
        409,
        "user_exists",
        "Denne e-posten er allerede registrert og knyttet til et firma. Logg inn i stedet, eller bruk en annen e-post.",
        { rid }
      );
    }

    // =========================
    // 3) Finn auth-user om nødvendig (for å kunne knytte riktig)
    // =========================
    let existingAuthUser: AdminUser | null = null;

    // Hvis prof finnes (uten company_id), så har vi user_id allerede, men vi kan fortsatt oppdatere metadata senere uten å hente auth-user.
    // Hvis prof ikke finnes, kan auth-user likevel finnes (User already registered). Vi sjekker dette før vi prøver createUser.
    if (!profByEmail.data?.user_id) {
      const found = await findAuthUserByEmailPaged(admin, admin_email, rid);
      if (found.error) {
        return jsonError(500, "auth_error", "Kunne ikke sjekke eksisterende bruker.", { rid, supabase: found.error });
      }
      existingAuthUser = found.user;
      // Hvis auth-user finnes og allerede er knyttet via profiles.user_id → stopp
      if (existingAuthUser?.id) {
        const profByUser = await admin
          .from("profiles")
          .select("user_id, company_id, role")
          .eq("user_id", existingAuthUser.id)
          .maybeSingle();

        if (profByUser.error) {
          return jsonError(500, "db_error", "Kunne ikke sjekke profil for eksisterende bruker.", { rid, supabase: profByUser.error });
        }

        if (profByUser.data?.company_id) {
          return jsonError(
            409,
            "user_exists",
            "Denne e-posten er allerede registrert og knyttet til et firma. Logg inn i stedet, eller bruk en annen e-post.",
            { rid }
          );
        }
      }
    }

    // =========================
    // 4) Opprett company (Pending) – først nå, når e-post er “OK”
    // =========================
    const companyInsert = await admin
      .from("companies")
      .insert({
        name: company_name,
        orgnr,
        status: "pending",
        employee_count, // ✅ riktig kolonne i din DB
      })
      .select("id")
      .single();

    if (companyInsert.error || !companyInsert.data?.id) {
      return jsonError(500, "db_error", "Kunne ikke opprette firma.", { rid, supabase: companyInsert.error });
    }

    const company_id = companyInsert.data.id as string;

    // =========================
    // 5) Opprett/oppdater admin-bruker + profile
    // =========================
    // Case A: profile finnes med email men uten company_id → knytt profilen til firma (user_id finnes)
    if (profByEmail.data?.user_id && !profByEmail.data?.company_id) {
      const user_id = profByEmail.data.user_id as string;

      // Oppdater auth metadata (best effort)
      const upd = await admin.auth.admin.updateUserById(user_id, {
        user_metadata: {
          role: "company_admin",
          full_name: admin_name,
          phone: admin_phone,
          company_id,
        },
      });

      if (upd.error) {
        // rollback company
        await admin.from("companies").delete().eq("id", company_id);
        return jsonError(500, "auth_error", "Kunne ikke oppdatere eksisterende bruker.", { rid, supabase: upd.error });
      }

      // Upsert profile (match schemaet ditt)
      const up = await admin.from("profiles").upsert(
        {
          user_id,
          company_id,
          role: "company_admin",
          name: admin_name,
          phone: admin_phone,
          email: admin_email,
          is_active: true,
        },
        { onConflict: "user_id" }
      );

      if (up.error) {
        await admin.from("companies").delete().eq("id", company_id);
        return jsonError(500, "db_error", "Kunne ikke knytte profil til firma.", { rid, supabase: up.error });
      }

      // Auto-login kan feile (eksisterende passord kan være annet)
      const supabase = await supabaseServer();
      const signIn = await supabase.auth.signInWithPassword({ email: admin_email, password });

      return NextResponse.json({
        ok: true,
        rid,
        company_id,
        status: "pending",
        autoLogin: !signIn.error,
        message: signIn.error
          ? "Firma registrert. Logg inn manuelt."
          : "Firma registrert. Du er nå logget inn.",
      });
    }

    // Case B: auth-user finnes (men ingen profile-email rad) → knytt (upsert) profile til firma
    if (existingAuthUser?.id) {
      const user_id = existingAuthUser.id;

      const upd = await admin.auth.admin.updateUserById(user_id, {
        user_metadata: {
          ...(existingAuthUser.user_metadata ?? {}),
          role: "company_admin",
          full_name: admin_name,
          phone: admin_phone,
          company_id,
        },
      });

      if (upd.error) {
        await admin.from("companies").delete().eq("id", company_id);
        return jsonError(500, "auth_error", "Kunne ikke oppdatere eksisterende bruker.", { rid, supabase: upd.error });
      }

      const up = await admin.from("profiles").upsert(
        {
          user_id,
          company_id,
          role: "company_admin",
          name: admin_name,
          phone: admin_phone,
          email: admin_email,
          is_active: true,
        },
        { onConflict: "user_id" }
      );

      if (up.error) {
        await admin.from("companies").delete().eq("id", company_id);
        return jsonError(500, "db_error", "Kunne ikke knytte profil til firma.", { rid, supabase: up.error });
      }

      // Auto-login er ikke garantert her → best effort
      const supabase = await supabaseServer();
      const signIn = await supabase.auth.signInWithPassword({ email: admin_email, password });

      return NextResponse.json({
        ok: true,
        rid,
        company_id,
        status: "pending",
        autoLogin: !signIn.error,
        message: signIn.error
          ? "Firma registrert. Logg inn med eksisterende konto for å fullføre."
          : "Firma registrert. Du er nå logget inn.",
      });
    }

    // Case C: Ny bruker – opprett auth + insert profile + auto-login
    const createUser = await admin.auth.admin.createUser({
      email: admin_email,
      password,
      email_confirm: false,
      user_metadata: {
        role: "company_admin",
        full_name: admin_name,
        phone: admin_phone,
        company_id,
      },
    });

    if (createUser.error || !createUser.data?.user?.id) {
      await admin.from("companies").delete().eq("id", company_id);
      return jsonError(500, "auth_error", "Kunne ikke opprette admin-bruker.", { rid, supabase: createUser.error });
    }

    const user_id = createUser.data.user.id;

    const profRes = await admin.from("profiles").insert({
      user_id,
      company_id,
      role: "company_admin",
      name: admin_name,
      phone: admin_phone,
      email: admin_email,
      is_active: true,
    });

    if (profRes.error) {
      await admin.auth.admin.deleteUser(user_id);
      await admin.from("companies").delete().eq("id", company_id);
      return jsonError(500, "db_error", "Kunne ikke opprette profil.", { rid, supabase: profRes.error });
    }

    const supabase = await supabaseServer();
    const signIn = await supabase.auth.signInWithPassword({ email: admin_email, password });

    if (signIn.error) {
      return NextResponse.json({
        ok: true,
        rid,
        company_id,
        status: "pending",
        autoLogin: false,
        message: "Firma registrert. Logg inn manuelt.",
      });
    }

    return NextResponse.json({
      ok: true,
      rid,
      company_id,
      status: "pending",
      autoLogin: true,
      message: "Firma registrert. Du er nå logget inn.",
    });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil i onboarding.", { rid, message: String(e?.message ?? e) });
  }
}
