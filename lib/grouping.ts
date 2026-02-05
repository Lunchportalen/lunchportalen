export const OSLO_TZ = "Europe/Oslo";

export type DbOrderRow = {
  id: string;
  user_id: string;
  note: string | null;
  created_at: string;
  company_id: string | null;
  location_id: string | null;
  companies?: { id: string; name: string } | { id: string; name: string }[] | null;
  company_locations?:
    | {
        id: string;
        label: string;
        address_line1: string;
        postal_code: string;
        city: string;
        delivery_window_start: string | null;
        delivery_window_end: string | null;
      }
    | any
    | null;
};

export type ProfileRow = {
  user_id: string;
  name: string;
  department: string | null;
};

export type KitchenOrder = {
  orderId: string;
  userId: string;
  name: string;
  department: string | null;
  note: string | null;
  createdAt: string;
  timeOslo: string;
};

export type KitchenGroup = {
  key: string;
  deliveryWindow: string; // "10:30–11:00"
  company: { id: string; name: string };
  location: {
    id: string;
    label: string;
    addressLine1: string;
    postalCode: string;
    city: string;
  };
  count: number;
  orders: KitchenOrder[];
};

function pickObj<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function hhmm(v: string | null | undefined) {
  if (!v) return "";
  // "10:30:00" -> "10:30" eller "10:30"
  return v.slice(0, 5);
}

export function formatOsloTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      timeZone: OSLO_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function formatDeliveryWindow(start: string | null, end: string | null) {
  const s = hhmm(start);
  const e = hhmm(end);
  if (s && e) return `${s}–${e}`;
  if (s) return `${s}–`;
  if (e) return `–${e}`;
  return "Ukjent vindu";
}

export function buildKitchenGroups(rows: DbOrderRow[], profiles: Map<string, ProfileRow>) {
  const groups = new Map<string, KitchenGroup>();

  for (const r of rows) {
    const company = pickObj(r.companies);
    const loc = pickObj(r.company_locations);

    if (!company || !loc) continue; // skal ikke skje når FK er satt, men vi er robuste

    const window = formatDeliveryWindow(loc.delivery_window_start, loc.delivery_window_end);
    const key = `${window}||${company.id}||${loc.id}`;

    const p = profiles.get(r.user_id);
    const name = (p?.name && p.name.trim()) ? p.name.trim() : "Ukjent navn";
    const dept = p?.department ?? null;

    const order: KitchenOrder = {
      orderId: r.id,
      userId: r.user_id,
      name,
      department: dept,
      note: r.note ?? null,
      createdAt: r.created_at,
      timeOslo: formatOsloTime(r.created_at),
    };

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        deliveryWindow: window,
        company: { id: company.id, name: company.name },
        location: {
          id: loc.id,
          label: loc.label,
          addressLine1: loc.address_line1,
          postalCode: loc.postal_code,
          city: loc.city,
        },
        count: 0,
        orders: [],
      });
    }

    const g = groups.get(key)!;
    g.orders.push(order);
    g.count++;
  }

  // Sortering: vindu, firma, lokasjon, og så tid i hver gruppe
  const arr = Array.from(groups.values());
  arr.sort((a, b) => {
    const w = a.deliveryWindow.localeCompare(b.deliveryWindow);
    if (w) return w;
    const c = a.company.name.localeCompare(b.company.name);
    if (c) return c;
    return a.location.label.localeCompare(b.location.label);
  });

  for (const g of arr) {
    g.orders.sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1));
  }

  return arr;
}
