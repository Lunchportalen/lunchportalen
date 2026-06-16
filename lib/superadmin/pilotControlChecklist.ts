/** Pure checklist evaluation for Pilot Control Center — no server deps. */

export type ChecklistLevel = "PASS" | "WATCH" | "FAIL";

export type GoldenPathChecklistItem = {
  id: string;
  label: string;
  level: ChecklistLevel;
  detail: string;
};

export type PilotHealthFlags = {
  goldenPathOk: boolean;
  providerOrderVisible: boolean;
  employeeOrderExists: boolean;
  productionStatusFlowProven: boolean;
  manualControlRequired: boolean;
};

export type PilotChecklistInput = {
  companyActive: boolean;
  agreementActive: boolean;
  employeesActive: number;
  menuPublishedForUpcoming: boolean;
  ordersThisWeek: number;
  latestOrderStatus: string | null;
  latestOrderHasDisplayLine: boolean;
  providerMatchesScope: boolean;
};

export function evaluateGoldenPathChecklist(input: PilotChecklistInput): GoldenPathChecklistItem[] {
  const productionAdvanced =
    input.latestOrderStatus === "PREPARED" ||
    input.latestOrderStatus === "DISPATCHED" ||
    input.latestOrderStatus === "DELIVERED";
  const readyOrDelivered =
    input.latestOrderStatus === "DISPATCHED" || input.latestOrderStatus === "DELIVERED";

  return [
    {
      id: "company_active",
      label: "Firma aktivt",
      level: input.companyActive ? "PASS" : "FAIL",
      detail: input.companyActive ? "Firma er aktivt i systemet." : "Firma er ikke aktivt — krever oppfølging.",
    },
    {
      id: "agreement_active",
      label: "Avtale aktiv",
      level: input.agreementActive ? "PASS" : "FAIL",
      detail: input.agreementActive ? "Aktiv avtale er bekreftet." : "Ingen aktiv avtale — bestilling er blokkert.",
    },
    {
      id: "employee_active",
      label: "Ansatt aktiv",
      level: input.employeesActive > 0 ? "PASS" : "WATCH",
      detail:
        input.employeesActive > 0
          ? `${input.employeesActive} aktiv(e) ansatt(er).`
          : "Ingen aktive ansatte — inviter kontrollert.",
    },
    {
      id: "menu_visible",
      label: "Meny synlig",
      level: input.menuPublishedForUpcoming ? "PASS" : "WATCH",
      detail: input.menuPublishedForUpcoming
        ? "Publisert meny finnes for kommende leveringsdag."
        : "Ingen publisert meny funnet for neste leveringsdag.",
    },
    {
      id: "order_created",
      label: "Ordre opprettet",
      level: input.ordersThisWeek > 0 ? "PASS" : "WATCH",
      detail:
        input.ordersThisWeek > 0
          ? `${input.ordersThisWeek} ordre denne uken.`
          : "Ingen ordre denne uken ennå.",
    },
    {
      id: "provider_sees_order",
      label: "Leverandør ser ordre",
      level: input.providerMatchesScope && input.ordersThisWeek > 0 ? "PASS" : input.ordersThisWeek > 0 ? "WATCH" : "WATCH",
      detail:
        input.providerMatchesScope && input.ordersThisWeek > 0
          ? "Ordre er knyttet til riktig leverandør."
          : "Bekreft at leverandør ser ordre i egen ordreliste.",
    },
    {
      id: "production_started",
      label: "Produksjon startet",
      level: productionAdvanced ? "PASS" : input.ordersThisWeek > 0 ? "WATCH" : "WATCH",
      detail: productionAdvanced
        ? "Status er kommet forbi mottatt."
        : "Produksjon er ikke startet ennå.",
    },
    {
      id: "ready_delivered",
      label: "Klar/levert",
      level: readyOrDelivered ? "PASS" : productionAdvanced ? "WATCH" : "WATCH",
      detail: readyOrDelivered
        ? "Ordre er merket klar for levering eller levert."
        : "Ordre er ikke merket klar/levert ennå.",
    },
    {
      id: "details_preserved",
      label: "Detaljer bevart",
      level: input.latestOrderHasDisplayLine ? "PASS" : input.ordersThisWeek > 0 ? "WATCH" : "WATCH",
      detail: input.latestOrderHasDisplayLine
        ? "Ordrelinje og valg er synlige."
        : "Ordre finnes, men linjedetaljer mangler i observasjon.",
    },
  ];
}

export function derivePilotHealthFlags(
  checklist: GoldenPathChecklistItem[],
  input: PilotChecklistInput,
): PilotHealthFlags {
  const failCount = checklist.filter((c) => c.level === "FAIL").length;
  const passCount = checklist.filter((c) => c.level === "PASS").length;
  const productionProven =
    input.latestOrderStatus === "PREPARED" ||
    input.latestOrderStatus === "DISPATCHED" ||
    input.latestOrderStatus === "DELIVERED";

  return {
    goldenPathOk: failCount === 0 && passCount >= 6,
    providerOrderVisible: input.providerMatchesScope && input.ordersThisWeek > 0,
    employeeOrderExists: input.ordersThisWeek > 0,
    productionStatusFlowProven: productionProven,
    manualControlRequired: true,
  };
}

export type OperationalBadge = "GO with manual control" | "WATCH" | "STOP";

export function deriveOperationalBadge(checklist: GoldenPathChecklistItem[]): OperationalBadge {
  const fails = checklist.filter((c) => c.level === "FAIL").length;
  const passes = checklist.filter((c) => c.level === "PASS").length;
  if (fails > 0) return "STOP";
  if (passes >= 5) return "GO with manual control";
  return "WATCH";
}
