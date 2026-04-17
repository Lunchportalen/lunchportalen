import crypto from "node:crypto";

export type SystemTestContext = {
  /** Unique id for this run (UUID). */
  testId: string;
  /** Human-readable prefix for names (TEST_COMPANY_<unix_ms>). */
  testLabel: string;
  companyName: string;
  locationName: string;
  employeeEmail: string;
  /** Order date YYYY-MM-DD (weekday, future). */
  orderDateISO: string;
  /** Agreement starts_at (past) for approval RPCs. */
  agreementStartsAtISO: string;

  companyId: string | null;
  locationId: string | null;
  agreementId: string | null;
  /** Auth user id == profiles.id for employee. */
  userId: string | null;
  /** Set by createEmployee — required for lp_order_set (authenticated RPC). */
  employeePassword: string | null;
  orderId: string | null;
};

export function createContext(): SystemTestContext {
  const testId = crypto.randomUUID();
  const ts = Date.now();
  const testLabel = `TEST_COMPANY_${ts}`;

  const { orderDateISO, agreementStartsAtISO } = pickOrderAndAgreementDates();

  return {
    testId,
    testLabel,
    companyName: testLabel,
    locationName: `TEST_LOCATION_${ts}`,
    employeeEmail: `system.test.${ts}.${testId.slice(0, 8)}@test.lunchportalen.invalid`,
    orderDateISO,
    agreementStartsAtISO,
    companyId: null,
    locationId: null,
    agreementId: null,
    userId: null,
    employeePassword: null,
    orderId: null,
  };
}

/** Next weekday strictly after today (UTC) — avoids weekend-only dates for order/window logic. */
function pickOrderAndAgreementDates(): { orderDateISO: string; agreementStartsAtISO: string } {
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  };
  const toISO = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  let order = addDays(new Date(), 2);
  while (order.getUTCDay() === 0 || order.getUTCDay() === 6) {
    order = addDays(order, 1);
  }

  const start = addDays(order, -14);
  return { orderDateISO: toISO(order), agreementStartsAtISO: toISO(start) };
}
