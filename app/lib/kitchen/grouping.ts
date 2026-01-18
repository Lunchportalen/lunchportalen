// lib/kitchen/grouping.ts
export type DbOrderRow = {
  id: string;
  user_id: string;
  note: string | null;
  created_at: string;

  company_id: string;
  location_id: string;

  // joins fra select(...)
  companies?: { id: string; name: string } | null;

  company_locations?: {
    id: string;
    name?: string | null; // noen har name
    label?: string | null; // noen har label
    address?: string | null;
    address_line1?: string | null; // noen har address_line1
    postal_code?: string | null;
    city?: string | null;
    delivery_json?: any; // { windowFrom/windowTo } eller andre varianter
  } | null;
};

export type ProfileRow = {
  user_id: string;
  name: string | null;
  department?: string | null;
};

export type KitchenOrder = {
  orderId: string;
  userId: string;
  name: string;
  department: string | null;
  note: string | null;
  timeOslo: string | null; // HH:MM (best-effort)
};

export type KitchenCompany = { id: string; name: string };

export type KitchenLocation = {
  id: string;
  label: string;
  addressLine1: string;
  postalCode: string;
  city: string;
};

export type KitchenGroup = {
  key: string; // unikt per gruppe
  deliveryWindow: string; // f.eks. "10:30–11:00"
  company: KitchenCompany;
  location: KitchenLocation;
  count: number;
  orders: KitchenOrder[];
};

function s(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

function pickLocationLabel(loc: any): string {
  return s(loc?.label) || s(loc?.name) || "Ukjent lokasjon";
}

function pickAddressLine1(loc: any): string {
  return s(loc?.address_line1) || s(loc?.address) || "—";
}

function pickPostalCode(loc: any): string {
  return s(loc?.postal_code) || "—";
}

function pickCity(loc: any): string {
  return s(loc?.city) || "—";
}

function toOsloTimeHHMM(isoLike: string | null | undefined): string | null {
  if (!isoLike) return null;
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hh = parts.find((p) => p.type === "hour")?.value;
  const mm = parts.find((p) => p.type === "minute")?.value;
  if (!hh || !mm) return null;
  return `${hh}:${mm}`;
}

function pickWindow(loc: any): { from: string | null; to: string | null } {
  const dj = loc?.delivery_json ?? null;

  const from =
    s(dj?.windowFrom) ||
    s(dj?.window_from) ||
    s(dj?.delivery_window_start) ||
    null;

  const to =
    s(dj?.windowTo) ||
    s(dj?.window_to) ||
    s(dj?.delivery_window_end) ||
    null;

  return { from, to };
}

function formatWindow(from: string | null, to: string | null): string {
  const f = from ?? "—";
  const t = to ?? "—";
  return `${f}–${t}`;
}

export function buildKitchenGroups(
  orders: DbOrderRow[],
  profilesMap: Map<string, ProfileRow>
): KitchenGroup[] {
  const groups = new Map<string, KitchenGroup>();

  for (const o of orders) {
    const company: KitchenCompany = {
      id: o.company_id,
      name: s(o.companies?.name) || "Ukjent firma",
    };

    const locRaw = o.company_locations ?? {};
    const loc: KitchenLocation = {
      id: o.location_id,
      label: pickLocationLabel(locRaw),
      addressLine1: pickAddressLine1(locRaw),
      postalCode: pickPostalCode(locRaw),
      city: pickCity(locRaw),
    };

    const { from, to } = pickWindow(locRaw);
    const deliveryWindow = formatWindow(from, to);

    // gruppe-key = vindu + firma + lokasjon (stabil og unik)
    const key = `${deliveryWindow}__${company.id}__${loc.id}`;

    const prof = profilesMap.get(o.user_id);
    const personName = s(prof?.name) || "Ukjent";
    const dept = s(prof?.department) || null;

    const order: KitchenOrder = {
      orderId: o.id,
      userId: o.user_id,
      name: personName,
      department: dept,
      note: s(o.note) ? s(o.note) : null,
      timeOslo: toOsloTimeHHMM(o.created_at),
    };

    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        key,
        deliveryWindow,
        company,
        location: loc,
        count: 1,
        orders: [order],
      });
    } else {
      g.count += 1;
      g.orders.push(order);
    }
  }

  // Sorter grupper: deliveryWindow → firma → lokasjon
  const out = Array.from(groups.values());
  out.sort((a, b) => {
    if (a.deliveryWindow !== b.deliveryWindow) return a.deliveryWindow.localeCompare(b.deliveryWindow);
    if (a.company.name !== b.company.name) return a.company.name.localeCompare(b.company.name);
    return a.location.label.localeCompare(b.location.label);
  });

  // Sorter ordre i hver gruppe: tid → avdeling → navn
  for (const g of out) {
    g.orders.sort((a, b) => {
      const at = a.timeOslo ?? "";
      const bt = b.timeOslo ?? "";
      if (at !== bt) return at.localeCompare(bt);

      const ad = a.department ?? "";
      const bd = b.department ?? "";
      if (ad !== bd) return ad.localeCompare(bd);

      return a.name.localeCompare(b.name);
    });
  }

  return out;
}
