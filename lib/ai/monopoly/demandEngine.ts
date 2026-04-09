import type { BusinessState } from "@/lib/ai/businessStateEngine";

export function controlDemand(ctx: Pick<BusinessState, "traffic" | "conversion">): string[] {
  const actions: string[] = [];
  if (ctx.traffic < 1000) {
    actions.push("INCREASE_CONTENT_OUTPUT");
  }
  if (ctx.conversion < 0.02) {
    actions.push("SHIFT_POSITIONING");
  }
  return actions;
}
