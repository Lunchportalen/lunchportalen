import {
  GET as getProfile,
} from "@/app/api/profile/route";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request?: Request) {
  const rid = makeRid("rid_profile_adapter");

  try {
    const response = await getProfile(request);
    if (response instanceof Response) {
      return response;
    }
    return jsonOk(rid, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunne ikke hente profil.";
    return jsonErr(rid, message, 500, "PROFILE_ROUTE_ADAPTER_FAILED");
  }
}
