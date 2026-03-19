// app/api/superadmin/menu-publish/route.ts
import { requireRole } from "@/lib/auth/requireRole";
import { auditSuperadmin } from "@/lib/audit/actions";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function POST(req: Request) {
  const r = makeRid();
  const guard = await requireRole(["superadmin"]);
  if (!guard.ok) return jsonErr(r, "Ingen tilgang.", guard.status ?? 403, guard.error);

  const body = await req.json().catch(() => null);
  const date = body?.date;
  const publish = body?.publish;

  if (!date || typeof publish !== "boolean") {
    return jsonErr(r, "date/publish mangler eller er ugyldig.", 400, "BAD_REQUEST");
  }

  // Her kobler dere på eksisterende week-visibility / cron-logikk
  // Denne ruten er kun kontrollpunktet

  await auditSuperadmin({
    actor_user_id: guard.userId,
    action: "menu_publish.set",
    target_type: "week_visibility",
    target_id: String(date),
    target_label: `date=${date} publish=${publish}`,
    after: { date, publish },
    meta: { rid: r },
  });

  return jsonOk(r, { date, publish }, 200);
}
