/**
 * Multi-city / multi-kitchen / multi-zone — deterministisk aggregat (ingen nettverkskall).
 * Kapasitet er heuristikk ut fra observert etterspørsel; verifiser mot faktisk kjøkkenkapasitet.
 */

import type { OrderRowForDemand } from "@/lib/ai/demandData";
import { statusIsActive } from "@/lib/ai/demandData";
import { addDaysISO } from "@/lib/date/oslo";

export type CityKitchenZoneInput = {
  city: string;
  /** Lokasjoner i byen (kjøkken/soner). */
  locationIds: string[];
  /** Aktive ordre siste vindu (telling). */
  activeDemandWindow: number;
};

export type MultiCityBalanceRow = {
  city: string;
  demand: number;
  capacity: number;
  loadBalanceSuggestion: string;
};

function stableCityLabel(city: string) {
  const t = String(city ?? "").trim();
  return t.length ? t : "Ukjent";
}

/**
 * Teller ACTIVE-ordre per lokasjon i [from, to] (ISO datoer inkl.).
 */
export function activeDemandByLocation(
  rows: OrderRowForDemand[],
  from: string,
  to: string,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const d = String(r.date ?? "").trim();
    if (d < from || d > to) continue;
    if (!statusIsActive(r.status)) continue;
    const lid = String(r.location_id ?? "").trim();
    if (!lid) continue;
    m.set(lid, (m.get(lid) ?? 0) + 1);
  }
  return m;
}

/**
 * Bygger by-rader ut fra lokasjonsliste + etterspørsel per lokasjon.
 */
export function buildCityInputsFromLocations(
  locations: Array<{ id: string; city: string }>,
  demandByLocation: Map<string, number>,
): CityKitchenZoneInput[] {
  const byCity = new Map<string, Set<string>>();
  for (const loc of locations) {
    const city = stableCityLabel(loc.city);
    const id = String(loc.id ?? "").trim();
    if (!id) continue;
    if (!byCity.has(city)) byCity.set(city, new Set());
    byCity.get(city)!.add(id);
  }

  const out: CityKitchenZoneInput[] = [];
  for (const [city, ids] of [...byCity.entries()].sort((a, b) => a[0].localeCompare(b[0], "nb"))) {
    let sum = 0;
    for (const lid of ids) sum += demandByLocation.get(lid) ?? 0;
    out.push({ city, locationIds: [...ids].sort(), activeDemandWindow: sum });
  }
  return out;
}

/**
 * Kapasitet per «kjøkken» (lokasjon): minst 80 porsjoner/dag ekvivalent, buffer over observert snitt.
 */
function heuristicCapacityForLocation(demandAtLocation: number, windowDays: number) {
  const days = Math.max(1, windowDays);
  const avgDaily = demandAtLocation / days;
  return Math.max(80, Math.ceil(avgDaily * 1.35 + 24));
}

export function computeMultiCityBalance(
  inputs: CityKitchenZoneInput[],
  opts?: { windowDays?: number },
): MultiCityBalanceRow[] {
  const windowDays = Math.max(1, Math.min(30, opts?.windowDays ?? 14));
  return inputs.map((c) => {
    const kitchens = Math.max(1, c.locationIds.length);
    const demand = Math.max(0, Math.round(c.activeDemandWindow));
    const perKitchenDemand = demand / kitchens;
    let capacity = 0;
    for (let i = 0; i < kitchens; i++) capacity += heuristicCapacityForLocation(perKitchenDemand, windowDays);
    const ratio = capacity > 0 ? demand / capacity : 0;
    let loadBalanceSuggestion: string;
    if (demand === 0) {
      loadBalanceSuggestion = "Ingen observert etterspørsel i vinduet — verifiser data og lokasjonstilknytning.";
    } else if (ratio < 0.55) {
      loadBalanceSuggestion = "Lav belastning — vurder å konsolidere produksjon eller redusere innkjøpsvolum (manuell vurdering).";
    } else if (ratio < 0.92) {
      loadBalanceSuggestion = "Balansert belastning — behold overvåkning av buffer og leverandørledetid.";
    } else {
      loadBalanceSuggestion = "Høy belastning — vurder ekstra kapasitet, omfordeling til annet kjøkken eller justert rute (krever godkjenning).";
    }
    return {
      city: c.city,
      demand,
      capacity,
      loadBalanceSuggestion,
    };
  });
}

export function multiCityFromOrdersAndLocations(
  rows: OrderRowForDemand[],
  locations: Array<{ id: string; city: string }>,
  today: string,
  windowDays?: number,
): MultiCityBalanceRow[] {
  const wd = Math.max(1, Math.min(30, windowDays ?? 14));
  const from = addDaysISO(today, -(wd - 1));
  const byLoc = activeDemandByLocation(rows, from, today);
  const inputs = buildCityInputsFromLocations(locations, byLoc);
  return computeMultiCityBalance(inputs, { windowDays: wd });
}
