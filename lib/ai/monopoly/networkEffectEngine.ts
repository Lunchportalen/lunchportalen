import type { BusinessState } from "@/lib/ai/businessStateEngine";

export function amplifyNetworkEffects(ctx: Pick<BusinessState, "traffic" | "revenue">): string[] {
  const effects: string[] = [];
  if (ctx.traffic > 5000) {
    effects.push("CONTENT_FLYWHEEL");
  }
  if (ctx.revenue > 100000) {
    effects.push("BRAND_DOMINANCE");
  }
  return effects;
}
