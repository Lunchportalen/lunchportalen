import "server-only";

import { getPublicAppUrlFromEnv } from "@/lib/invites/employeeInviteUrl";

import { resolveTripletexProviderEnv } from "./resolveTripletexProviderEnv";

export function buildProviderTripletexWebhookUrl(providerId: string): string {
  const base = getPublicAppUrlFromEnv();
  const env = resolveTripletexProviderEnv();
  return `${base}/api/webhooks/tripletex-provider/${encodeURIComponent(providerId)}?env=${encodeURIComponent(env)}`;
}
