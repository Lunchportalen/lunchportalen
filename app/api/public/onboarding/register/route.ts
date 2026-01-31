// app/api/public/onboarding/register/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

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

/**
 * Supabase Auth -> public.profiles kan være eventual consistent.
 * Vi venter kort til profile-raden finnes (DB-trigger på auth.users).
 */
async function waitForProfile(admin: any, userId: string, rid: string) {
  const maxRetries = 20; // ~4s
  const sleepMs = 200;

  for (let i = 0; i < maxRetries; i++) {
    const { data, error } = await admin.from("profiles").select("id, company_id, role").eq("id", userId).maybeSingle();
    if (!error && data?.id) return { ok: true as const, data };
    await new Promise((r) => setTimeout(r, sleepMs));
  }

  return { ok: false as const, error: { message: `PROFILE_NOT_CREATED (rid=${rid})` } };
}

export async function POST(req: Request) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = `onb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = await req.json();
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

    if (password.length < 10) return jsonError(400, "bad_request", "Passord må være minimum 10 tegn.", { rid });
    if (password !== password2) return jsonError(400, "bad_request", "Passordene matcher ikke.", { rid });

    // =========================
    // 1) Guard: unik orgnr
    // =========================
    const existingCompany = await admin.from("companies").select("id").eq("orgnr", orgnr).maybeSingle();
    if (existingCompany.data?.id) {
      return jsonError(409, "conflict", "Dette org.nr er allerede registrert.", { rid });
    }

    // =========================
    // 2) Best practice: sjekk e-post i profiles først (presis “er i systemet”-fasit)
    // ✅ FASIT: profiles.id (ikke user_id)
    // =========================
    const profByEmail = await admin.from("profiles").select("id, company_id, role, email").ilike("email", admin_email).maybeSingle();

    if (profByEmail.error) {
      return jsonError(500, "db_error", "Kunne ikke sjekke e-post i profiler.", { rid, supabase: profByEmail.error });
    }

    // Hvis e-post finnes og allerede er knyttet til firma → stopp (enterprise-strengt)
    if (profByEmail.data?.id && profByEmail.data?.company_id) {
      return jsonError(
        409,
        "user_exists",
        "Denne e-posten er allerede registrert og knyttet til et firma. Logg inn i stedet, eller bruk en annen e-post.",
        { rid }
      );
    }

    // =========================
    // 3) Finn auth-user om nødvendig
    // =========================
    let existingAuthUser: AdminUser | null = null;

    if (!profByEmail.data?.id) {
      const found = await findAuthUserByEmailPaged(admin, admin_email, rid);
      if (found.error) {
        return jsonError(500, "auth_error", "Kunne ikke sjekke eksisterende bruker.", { rid, supabase: found.error });
      }
      existingAuthUser = found.user;

      // Hvis auth-user finnes og profile allerede er knyttet til firma → stopp
      if (existingAuthUser?.id) {
        const profByUser = await admin.from("profiles").select("id, company_id, role").eq("id", existingAuthUser.id).maybeSingle();
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
    // 4) Opprett company (Pending) – først når e-post er OK
    // =========================
    const companyInsert = await admin
      .from("companies")
      .insert({
        name: company_name,
        orgnr,
        status: "pending",
        employee_count,
      })
      .select("id")
      .single();

    if (companyInsert.error || !companyInsert.data?.id) {
      return jsonError(500, "db_error", "Kunne ikke opprette firma.", { rid, supabase: companyInsert.error });
    }

    const company_id = companyInsert.data.id as string;

    // =========================
    // 5) Opprett/oppdater admin-bruker
    // ✅ Viktig: vi skriver IKKE profiles.insert/upsert her (FK-race).
    // DB-trigger på auth.users oppretter profiles-raden.
    // Etterpå oppdaterer vi profilen (trygge felter) når den finnes.
    // =========================

    // Case A: profile finnes (email) men uten company_id → vi må knytte til firma uten “company_id update” i app.
    // Her er fasit: oppdater auth metadata (company_id), trigger-opprettet profil vil plukke det opp på INSERT.
    // Hvis profilen allerede finnes fra før, må superadmin håndtere flytting (vi stopper).
    if (profByEmail.data?.id && !profByEmail.data?.company_id) {
      // Dette er en “ghost/ubundet” profil. Vi skal IKKE endre company_id via update her.
      // Vi krever ny bruker (eller superadmin). For onboarding: stopp tidlig.
      await admin.from("companies").delete().eq("id", company_id);
      return jsonError(
        409,
        "profile_exists_unbound",
        "Denne e-posten finnes allerede i systemet (ubundet profil). Kontakt superadmin for opprydding før onboarding.",
        { rid }
      );
    }

    // Case B: auth-user finnes men ingen bundet profil
    if (existingAuthUser?.id) {
      const user_id = existingAuthUser.id;

      const upd = await admin.auth.admin.updateUserById(user_id, {
        password, // sett nytt passord som del av onboarding (kontrollert)
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

      // Vent til profile finnes (eller finnes allerede) – oppdater trygge felter (ikke company_id)
      const waited = await waitForProfile(admin, user_id, rid);
      if (!waited.ok) {
        await admin.from("companies").delete().eq("id", company_id);
        return jsonError(500, "profile_not_created", "Profil ble ikke opprettet automatisk.", { rid, detail: waited.error });
      }

      const profUpd = await admin
        .from("profiles")
        .update({
          role: "company_admin",
          name: admin_name,
          phone: admin_phone,
          email: admin_email,
          is_active: true,
          disabled_at: null,
          disabled_reason: null,
        })
        .eq("id", user_id);

      if (profUpd.error) {
        await admin.from("companies").delete().eq("id", company_id);
        return jsonError(500, "db_error", "Kunne ikke oppdatere profil.", { rid, supabase: profUpd.error });
      }

      const supabase = await supabaseServer();
      const signIn = await supabase.auth.signInWithPassword({ email: admin_email, password });

      return NextResponse.json({
        ok: true,
        rid,
        company_id,
        status: "pending",
        autoLogin: !signIn.error,
        message: signIn.error ? "Firma registrert. Logg inn manuelt." : "Firma registrert. Du er nå logget inn.",
      });
    }

    // Case C: Ny bruker – opprett auth. Profiles lages av trigger. Deretter oppdater trygge felter.
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

    // Vent på trigger-opprettet profil
    const waited = await waitForProfile(admin, user_id, rid);
    if (!waited.ok) {
      await admin.auth.admin.deleteUser(user_id);
      await admin.from("companies").delete().eq("id", company_id);
      return jsonError(500, "profile_not_created", "Profil ble ikke opprettet automatisk.", { rid, detail: waited.error });
    }

    // Oppdater trygge felter (IKKE company_id)
    const profUpd = await admin
      .from("profiles")
      .update({
        role: "company_admin",
        name: admin_name,
        phone: admin_phone,
        email: admin_email,
        is_active: true,
        disabled_at: null,
        disabled_reason: null,
      })
      .eq("id", user_id);

    if (profUpd.error) {
      await admin.auth.admin.deleteUser(user_id);
      await admin.from("companies").delete().eq("id", company_id);
      return jsonError(500, "db_error", "Kunne ikke oppdatere profil.", { rid, supabase: profUpd.error });
    }

    const supabase = await supabaseServer();
    const signIn = await supabase.auth.signInWithPassword({ email: admin_email, password });

    return NextResponse.json({
      ok: true,
      rid,
      company_id,
      status: "pending",
      autoLogin: !signIn.error,
      message: signIn.error ? "Firma registrert. Logg inn manuelt." : "Firma registrert. Du er nå logget inn.",
    });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil i onboarding.", { rid, message: String(e?.message ?? e) });
  }
}



