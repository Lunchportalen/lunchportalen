/**
 * Kladd til oppfølging (ingen utsending — kun forslag i UI).
 */

export type LeadForClosing = {
  status?: string | null;
};

export function generateClosingMessage(lead: LeadForClosing): string {
  const s = String(lead.status ?? "").trim();
  if (s === "meeting") {
    return "Hei! Skal vi sette opp oppstart denne uken?";
  }
  if (s === "contacted") {
    return "Hei! Fikk du sett på dette? Kan vi ta en kort prat?";
  }
  return "Hei! Så du viste interesse – vil du høre hvordan dette kan funke hos dere?";
}
