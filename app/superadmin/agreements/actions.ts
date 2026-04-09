"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { computeRole, hasRole, type Role } from "@/lib/auth/roles";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { makeRid } from "@/lib/http/respond";
import {
  runLedgerAgreementApprove,
  runLedgerAgreementPause,
  runLedgerAgreementReject,
} from "@/lib/server/agreements/ledgerAgreementApproval";
import { supabaseServer } from "@/lib/supabase/server";

export type AgreementActionResult =
  | { ok: true; rid: string; message?: string }
  | { ok: false; rid: string; message: string; status?: number };

function pickUserId(u: { id?: string } | null | undefined) {
  return String(u?.id ?? "").trim();
}

async function requireSuperadmin(): Promise<
  | { ok: true; userId: string; scope: { user_id: string | null; email: string | null; role: string | null } }
  | { ok: false; message: string }
> {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;
  const userId = pickUserId(user);

  if (error || !userId) {
    return { ok: false, message: "Ikke innlogget." };
  }

  let profileRole: unknown = null;
  try {
    profileRole = await getRoleForUser(userId);
  } catch {
    profileRole = null;
  }

  const role: Role = computeRole(user, profileRole as any);
  if (!hasRole(role, ["superadmin"])) {
    return { ok: false, message: "Ingen tilgang." };
  }

  return {
    ok: true,
    userId,
    scope: {
      user_id: userId,
      email: user?.email ?? null,
      role: String(role),
    },
  };
}

export async function approveAgreement(agreementId: string): Promise<AgreementActionResult> {
  const rid = makeRid("agreement_approve");
  const gate = await requireSuperadmin();
  if (gate.ok === false) {
    return { ok: false, rid, message: gate.message, status: 403 };
  }

  const out = await runLedgerAgreementApprove({
    rid,
    agreementId: String(agreementId ?? "").trim(),
    actorUserId: gate.userId,
    scope: gate.scope,
  });

  if (out.ok === false) {
    return { ok: false, rid, message: out.message, status: out.status };
  }

  revalidatePath("/superadmin/agreements");
  revalidatePath(`/superadmin/agreements/${agreementId}`);
  return { ok: true, rid, message: String(out.data?.message ?? "Avtalen er godkjent") };
}

export async function rejectAgreement(agreementId: string, reason: string): Promise<AgreementActionResult> {
  const rid = makeRid("agreement_reject");
  const gate = await requireSuperadmin();
  if (gate.ok === false) {
    return { ok: false, rid, message: gate.message, status: 403 };
  }

  const out = await runLedgerAgreementReject({
    rid,
    agreementId: String(agreementId ?? "").trim(),
    reason: reason ? String(reason) : null,
    actorUserId: gate.userId,
    scope: gate.scope,
  });

  if (out.ok === false) {
    return { ok: false, rid, message: out.message, status: out.status };
  }

  revalidatePath("/superadmin/agreements");
  revalidatePath(`/superadmin/agreements/${agreementId}`);
  return { ok: true, rid, message: String(out.data?.message ?? "Avtalen er avslått") };
}

export async function pauseAgreementLedger(agreementId: string): Promise<AgreementActionResult> {
  const rid = makeRid("agreement_pause_ledger");
  const gate = await requireSuperadmin();
  if (gate.ok === false) {
    return { ok: false, rid, message: gate.message, status: 403 };
  }

  const out = await runLedgerAgreementPause({
    rid,
    agreementId: String(agreementId ?? "").trim(),
    actorUserId: gate.userId,
    scope: gate.scope,
  });

  if (out.ok === false) {
    return { ok: false, rid, message: out.message, status: out.status };
  }

  revalidatePath("/superadmin/agreements");
  revalidatePath(`/superadmin/agreements/${agreementId}`);
  return { ok: true, rid, message: String(out.data?.message ?? "Avtalen er satt på pause") };
}
