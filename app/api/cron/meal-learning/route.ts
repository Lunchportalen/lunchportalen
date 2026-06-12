import { NextRequest, NextResponse } from "next/server";

/* agents-ci: JSON responses include rid. Ruten er fail-closed disabled: det finnes ingen
   ok: true, rid: suksessrespons så lenge guarden står — alle svar er ok: false, rid: med status. */

import { requireCronAuth } from "@/lib/http/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FAIL-CLOSED GUARD — meal learning er deaktivert (audit etter PR #181).
 *
 * Hvorfor:
 * - Tidligere attribusjon var global date-only (`Map<date, doc>`): alle ordrer for en dato
 *   ble tilskrevet ett vilkårlig menuDay-mealRef, på tvers av provider/tier/kategori.
 * - `orders` persisterer ikke tier/planTier — trygg (provider, dato, tier, kategori)-
 *   attribusjon kan derfor ikke bestemmes uten å gjette.
 * - Sanity `mealIdea` (mealRef-målet) er en globalt delt idébank uten provider-felt —
 *   `aiMenuLearning` kan ikke lagre provider-spesifikk læring uten ny datamodell.
 *
 * Provider-safe learning krever egen datamodell (persisted tier på ordre + provider-scoped
 * lagring i Sanity). Inntil det finnes: ingen order-lesing, ingen Sanity-lesing, ingen patch.
 * Cron-auth beholdes uendret. Ruten er bevisst ikke planlagt i `vercel.json`.
 */

function makeRid() {
    return `meal_learning_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function jsonError(
    rid: string,
    error: string,
    status = 500,
    extra?: Record<string, unknown>
) {
    return NextResponse.json(
        {
            ok: false,
            rid,
            error,
            message: error,
            status,
            ...(extra ?? {}),
        },
        { status }
    );
}

export async function GET(req: NextRequest) {
    const rid = makeRid();

    try {
        requireCronAuth(req);
    } catch (e: unknown) {
        const msg = String((e as Error)?.message ?? e);
        const code = String((e as { code?: string })?.code ?? "").trim();
        if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
            return jsonError(rid, "CRON_SECRET mangler i env", 500);
        }
        return jsonError(rid, "Unauthorized", 401);
    }

    // fail-closed: kontrollert disabled-respons uten side effects.
    return NextResponse.json(
        {
            ok: false,
            rid,
            disabled: true,
            reason: "provider_safe_learning_model_missing",
            error: "provider_safe_learning_model_missing",
            message:
                "Meal learning is disabled until orders persist tier and Sanity learning is provider-scoped.",
            status: 503,
            requirements: [
                "orders must persist provider-safe tier/planTier at write time",
                "Sanity meal learning must support provider-scoped storage",
            ],
        },
        { status: 503 }
    );
}
