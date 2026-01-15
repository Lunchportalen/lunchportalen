"use client";

import { useEffect, useMemo, useState } from "react";

/* =========================
   TAB A: UKEMENY (preview)
   /api/week?weekOffset=0|1
========================= */
type MenuDayItem = {
  date: string;
  weekday: string;
  isPublished: boolean;
  description: string | null;
  allergens: string[];
};

type WeekResp = {
  ok: boolean;
  range: { from: string; to: string };
  weekOffset: 0 | 1;
  days: MenuDayItem[];
  error?: string;
  detail?: string;
};

/* =========================
   ROLE (stram tilgang)
   /api/me -> { role }
========================= */
type Role = "employee" | "company_admin" | "superadmin";

/* =========================
   TAB B: BESTILLING (2 uker)
   /api/order/window?weeks=2
   /api/order/set-choice
   /api/order/bulk-set
========================= */
type Choice = { key: string; label?: string };

type OrderDay = {
  date: string;
  weekday: "mon" | "tue" | "wed" | "thu" | "fri";
  tier: "BASIS" | "PREMIUM";
  isLocked: boolean;
  allowedChoices: Choice[];
  selected: string | null;
};

type WindowResp = {
  ok: boolean;
  range: { from: string; to: string };
  days: OrderDay[];
  error?: string;
  detail?: string;
};

function weekdayLabel(w: OrderDay["weekday"]) {
  const map: Record<OrderDay["weekday"], string> = {
    mon: "Man",
    tue: "Tir",
    wed: "Ons",
    thu: "Tor",
    fri: "Fre",
  };
  return map[w] ?? w;
}

type Tab = "menu" | "order";

const LS_BASIS = "lp_default_choice_basis";
const LS_PREMIUM = "lp_default_choice_premium";
const LS_AUTO = "lp_default_choice_auto_apply";

function StatusPill({ published }: { published: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
        published ? "border-white/25" : "border-white/15 opacity-80"
      }`}
      title={published ? "Publisert" : "Ikke publisert"}
    >
      <span className="inline-block h-2 w-2 rounded-full border border-white/30" />
      {published ? "Publisert" : "Ikke publisert"}
    </span>
  );
}

export default function WeekClient() {
  const [tab, setTab] = useState<Tab>("menu");

  // ===== ROLE
  const [role, setRole] = useState<Role>("employee");
  const [roleLoading, setRoleLoading] = useState(true);

  // ===== TAB A state
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuData, setMenuData] = useState<WeekResp | null>(null);
  const [menuMsg, setMenuMsg] = useState<string | null>(null);

  // ===== TAB B state
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderData, setOrderData] = useState<WindowResp | null>(null);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // ===== Standardvalg per tier (lokalt)
  const [defaultBasis, setDefaultBasis] = useState<string>("");
  const [defaultPremium, setDefaultPremium] = useState<string>("");
  const [autoApplyDefaults, setAutoApplyDefaults] = useState<boolean>(false);

  // ===== Role fetch
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const r = json?.role as Role | undefined;
          if (r === "employee" || r === "company_admin" || r === "superadmin") {
            setRole(r);
          }
        }
      } catch {
        // ignore → fall back employee
      } finally {
        setRoleLoading(false);
      }
    })();
  }, []);

  const canSeeDraftMenu = role === "company_admin" || role === "superadmin";

  async function loadMenu() {
    setMenuLoading(true);
    setMenuMsg(null);

    try {
      const res = await fetch(`/api/week?weekOffset=${weekOffset}`, { cache: "no-store" });
      const json = (await res.json()) as WeekResp;

      if (!res.ok || !json.ok) {
        setMenuMsg(json.error || "Kunne ikke hente ukemeny.");
        setMenuData(null);
        return;
      }

      setMenuData(json);
    } catch {
      setMenuMsg("Kunne ikke hente ukemeny. Prøv igjen.");
      setMenuData(null);
    } finally {
      setMenuLoading(false);
    }
  }

  async function loadOrderWindow() {
    setOrderLoading(true);
    setOrderMsg(null);

    try {
      const res = await fetch("/api/order/window?weeks=2", { cache: "no-store" });
      const json = (await res.json()) as WindowResp;

      if (!res.ok || !json.ok) {
        setOrderMsg(json.error || "Kunne ikke hente bestilling.");
        setOrderData(null);
        return;
      }

      setOrderData(json);
    } catch {
      setOrderMsg("Kunne ikke hente bestilling. Prøv igjen.");
      setOrderData(null);
    } finally {
      setOrderLoading(false);
    }
  }

  async function setChoice(date: string, choice_key: string) {
    setSavingDate(date);
    setOrderMsg(null);

    try {
      const res = await fetch("/api/order/set-choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, choice_key }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setOrderMsg(json.error || "Kunne ikke lagre valg.");
        return;
      }

      setOrderData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) => (d.date === date ? { ...d, selected: choice_key } : d)),
        };
      });
    } catch {
      setOrderMsg("Kunne ikke lagre valg. Prøv igjen.");
    } finally {
      setSavingDate(null);
    }
  }

  // ✅ Bulk set (tier/uke) – API validerer og skipper låste dager
  async function bulkSet(choice_key: string, opts?: { tier?: "BASIS" | "PREMIUM"; weekIndex?: 0 | 1 }) {
    setBulkBusy(true);
    setOrderMsg(null);

    try {
      const res = await fetch("/api/order/bulk-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice_key, ...opts }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setOrderMsg(json.error || "Bulk feilet.");
        return;
      }

      await loadOrderWindow();
    } catch {
      setOrderMsg("Bulk feilet. Prøv igjen.");
    } finally {
      setBulkBusy(false);
    }
  }

  // ✅ Kopier uke 1 → uke 2 (dag-for-dag, respekterer lås + tier)
  async function copyWeek1ToWeek2() {
    if (!orderData?.days?.length) return;

    setBulkBusy(true);
    setOrderMsg(null);

    try {
      const days = orderData.days;
      const week1 = days.slice(0, 5);
      const week2 = days.slice(5, 10);

      if (week1.length !== 5 || week2.length !== 5) {
        throw new Error("Fant ikke to komplette uker (forventet 10 hverdager).");
      }

      const w1ByWeekday = new Map<OrderDay["weekday"], string>();
      for (const d of week1) {
        if (d.selected) w1ByWeekday.set(d.weekday, d.selected);
      }

      const targets: Array<{ date: string; choice_key: string }> = [];
      for (const d2 of week2) {
        if (d2.isLocked) continue;
        const pick = w1ByWeekday.get(d2.weekday);
        if (!pick) continue;

        const ok = d2.allowedChoices?.some((c) => c.key === pick);
        if (!ok) continue;

        if (d2.selected === pick) continue;

        targets.push({ date: d2.date, choice_key: pick });
      }

      if (targets.length === 0) {
        setOrderMsg("Ingenting å kopiere (låst/ikke tillatt/ingen valg i uke 1).");
        return;
      }

      for (const t of targets) {
        const res = await fetch("/api/order/set-choice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: t.date, choice_key: t.choice_key }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Kunne ikke kopiere ${t.date}.`);
        }
      }

      await loadOrderWindow();
    } catch (e: any) {
      setOrderMsg(e.message || "Kopiering feilet.");
    } finally {
      setBulkBusy(false);
    }
  }

  // ---- Dynamiske valg (ingen hardkodede keys)
  const basisChoices = useMemo(() => {
    const days = orderData?.days ?? [];
    const firstBasis = days.find((d) => d.tier === "BASIS");
    return firstBasis?.allowedChoices ?? [];
  }, [orderData]);

  const premiumChoices = useMemo(() => {
    const days = orderData?.days ?? [];
    const firstPrem = days.find((d) => d.tier === "PREMIUM");
    return firstPrem?.allowedChoices ?? [];
  }, [orderData]);

  // ---- Les lagrede standardvalg (én gang)
  useEffect(() => {
    try {
      const b = localStorage.getItem(LS_BASIS) ?? "";
      const p = localStorage.getItem(LS_PREMIUM) ?? "";
      const a = localStorage.getItem(LS_AUTO) ?? "0";
      setDefaultBasis(b);
      setDefaultPremium(p);
      setAutoApplyDefaults(a === "1");
    } catch {
      // ignore
    }
  }, []);

  // ---- Sørg for at standardvalg alltid peker på noe gyldig når data kommer inn
  useEffect(() => {
    if (!orderData?.days?.length) return;

    const basisKeys = new Set(basisChoices.map((c) => c.key));
    const premKeys = new Set(premiumChoices.map((c) => c.key));

    let nextBasis = defaultBasis;
    let nextPrem = defaultPremium;

    if ((!nextBasis || !basisKeys.has(nextBasis)) && basisChoices[0]?.key) nextBasis = basisChoices[0].key;
    if ((!nextPrem || !premKeys.has(nextPrem)) && premiumChoices[0]?.key) nextPrem = premiumChoices[0].key;

    if (nextBasis !== defaultBasis) {
      setDefaultBasis(nextBasis);
      try {
        localStorage.setItem(LS_BASIS, nextBasis);
      } catch {}
    }
    if (nextPrem !== defaultPremium) {
      setDefaultPremium(nextPrem);
      try {
        localStorage.setItem(LS_PREMIUM, nextPrem);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderData, basisChoices, premiumChoices]);

  function saveDefaultBasis(v: string) {
    setDefaultBasis(v);
    try {
      localStorage.setItem(LS_BASIS, v);
    } catch {}
  }

  function saveDefaultPremium(v: string) {
    setDefaultPremium(v);
    try {
      localStorage.setItem(LS_PREMIUM, v);
    } catch {}
  }

  function saveAutoApply(v: boolean) {
    setAutoApplyDefaults(v);
    try {
      localStorage.setItem(LS_AUTO, v ? "1" : "0");
    } catch {}
  }

  // ---- Auto-apply
  useEffect(() => {
    if (tab !== "order") return;
    if (!autoApplyDefaults) return;
    if (!orderData?.days?.length) return;

    const hasEmpty = orderData.days.some((d) => !d.selected && !d.isLocked);
    if (!hasEmpty) return;

    const run = async () => {
      if (defaultBasis) await bulkSet(defaultBasis, { tier: "BASIS" });
      if (defaultPremium) await bulkSet(defaultPremium, { tier: "PREMIUM" });
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, autoApplyDefaults, orderData]);

  // Last meny når weekOffset endrer seg
  useEffect(() => {
    loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  // Last bestilling første gang du går til tabben (lazy)
  useEffect(() => {
    if (tab === "order" && !orderData && !orderLoading) {
      loadOrderWindow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Ved første mount: load menu + klargjør order state (ikke last før tab)
  useEffect(() => {
    setOrderLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Stram visning av ukemeny (ansatt ser kun publiserte)
  const visibleMenuDays = useMemo(() => {
    const days = menuData?.days ?? [];
    if (roleLoading) return days; // mens rolle lastes: ikke endre atferd
    if (canSeeDraftMenu) return days;
    return days.filter((d) => d.isPublished);
  }, [menuData, roleLoading, canSeeDraftMenu]);

  return (
    <section className="rounded-xl border border-white/15 p-4">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("menu")}
            className={`rounded-lg border px-3 py-1 text-xs ${
              tab === "menu" ? "border-white/30 bg-white/10" : "border-white/15 opacity-80 hover:bg-white/5"
            }`}
          >
            Ukemeny
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("order");
              if (!orderData) loadOrderWindow();
            }}
            className={`rounded-lg border px-3 py-1 text-xs ${
              tab === "order" ? "border-white/30 bg-white/10" : "border-white/15 opacity-80 hover:bg-white/5"
            }`}
          >
            Bestilling (2 uker)
          </button>
        </div>

        {/* Right-side controls per tab */}
        {tab === "menu" ? (
          <div className="flex gap-2">
            <button
              className={`rounded-lg border border-white/15 px-3 py-1 text-xs ${
                weekOffset === 0 ? "bg-white/5" : "opacity-80 hover:bg-white/5"
              }`}
              onClick={() => setWeekOffset(0)}
              type="button"
            >
              Denne uke
            </button>
            <button
              className={`rounded-lg border border-white/15 px-3 py-1 text-xs ${
                weekOffset === 1 ? "bg-white/5" : "opacity-80 hover:bg-white/5"
              }`}
              onClick={() => setWeekOffset(1)}
              type="button"
            >
              Neste uke
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={loadOrderWindow}
            className="rounded-lg border border-white/15 px-3 py-1 text-xs opacity-80 hover:bg-white/5"
            disabled={orderLoading || bulkBusy}
          >
            Oppdater
          </button>
        )}
      </div>

      {/* Tab content */}
      {tab === "menu" ? (
        <>
          <div className="mt-3 text-sm opacity-80">
            {menuData?.range ? (
              <>
                Uke: <span className="font-medium">{menuData.range.from}</span> –{" "}
                <span className="font-medium">{menuData.range.to}</span>
              </>
            ) : (
              <>Ukevisning</>
            )}
          </div>

          {menuLoading ? (
            <div className="mt-3 text-sm opacity-70">Henter ukemeny…</div>
          ) : menuMsg ? (
            <div className="mt-3 text-sm opacity-70">{menuMsg}</div>
          ) : (
            <>
              {/* ✅ Hvis ansatt og ingenting er publisert: ryddig beskjed */}
              {!roleLoading && !canSeeDraftMenu && (menuData?.days?.length ?? 0) > 0 && visibleMenuDays.length === 0 ? (
                <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm opacity-80">
                  Ukemenyen er ikke publisert ennå.
                </div>
              ) : null}

              <div className="mt-4 divide-y divide-white/10 rounded-lg border border-white/10">
                {visibleMenuDays.map((d) => (
                  <div key={d.date} className="p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm font-medium">
                        {d.weekday} <span className="opacity-70">({d.date})</span>
                      </div>

                      {/* ✅ Admin ser status alltid. Ansatt ser kun publiserte dager, men pill er ok. */}
                      <StatusPill published={d.isPublished} />
                    </div>

                    <div className="mt-2 text-sm opacity-90">
                      {d.description ? d.description : <span className="opacity-60 italic">Ingen meny lagt inn.</span>}
                    </div>

                    {d.allergens?.length ? (
                      <div className="mt-1 text-xs opacity-70">Allergener: {d.allergens.join(", ")}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) }
        </>
      ) : (
        <>
          <div className="mt-3 text-sm opacity-80">
            {orderData?.range ? (
              <>
                Periode: <span className="font-medium">{orderData.range.from}</span> –{" "}
                <span className="font-medium">{orderData.range.to}</span>
              </>
            ) : (
              <>Bestilling</>
            )}
          </div>

          {/* ✅ Bulk toolbar + standardvalg */}
          {orderData?.days?.length ? (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">Hurtigvalg</div>

                <button
                  type="button"
                  disabled={bulkBusy || orderLoading}
                  onClick={copyWeek1ToWeek2}
                  className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
                >
                  Kopier uke 1 → uke 2
                </button>
              </div>

              {/* Standardvalg per tier */}
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-white/10 p-2">
                  <div className="text-xs opacity-70 mb-2">Standard for BASIS</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={defaultBasis}
                      onChange={(e) => saveDefaultBasis(e.target.value)}
                      className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-xs"
                      disabled={bulkBusy || !basisChoices.length}
                    >
                      {basisChoices.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label ?? c.key}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={bulkBusy || !defaultBasis}
                      onClick={() => bulkSet(defaultBasis, { tier: "BASIS" })}
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-50"
                    >
                      Bruk standard på BASIS-dager
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 p-2">
                  <div className="text-xs opacity-70 mb-2">Standard for PREMIUM</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={defaultPremium}
                      onChange={(e) => saveDefaultPremium(e.target.value)}
                      className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-xs"
                      disabled={bulkBusy || !premiumChoices.length}
                    >
                      {premiumChoices.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label ?? c.key}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={bulkBusy || !defaultPremium}
                      onClick={() => bulkSet(defaultPremium, { tier: "PREMIUM" })}
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-50"
                    >
                      Bruk standard på PREMIUM-dager
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggle auto-apply */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  id="autoApplyDefaults"
                  type="checkbox"
                  checked={autoApplyDefaults}
                  onChange={(e) => saveAutoApply(e.target.checked)}
                />
                <label htmlFor="autoApplyDefaults" className="text-xs opacity-80">
                  Auto-bruk standard når jeg åpner Bestilling (kun på tomme, ulåste dager)
                </label>
              </div>

              <div className="mt-2 text-xs opacity-60">
                Standardvalg lagres lokalt i nettleseren. Bulk oppdaterer kun dager som ikke er låst og som er tillatt
                av kontrakt.
              </div>
            </div>
          ) : null}

          {orderLoading ? (
            <div className="mt-3 text-sm opacity-70">Henter bestilling…</div>
          ) : orderMsg ? (
            <div className="mt-3 text-sm opacity-70">{orderMsg}</div>
          ) : (
            <div className="mt-4 divide-y divide-white/10 rounded-lg border border-white/10">
              {orderData?.days?.map((d) => (
                <div key={d.date} className="p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-medium">
                      {weekdayLabel(d.weekday)} <span className="opacity-70">({d.date})</span>
                    </div>
                    <div className="text-xs opacity-70">
                      {d.tier} {d.isLocked ? "• Låst" : "• Kan endres til 08:00"}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.allowedChoices?.map((c) => {
                      const active = d.selected === c.key;
                      const disabled = d.isLocked || savingDate === d.date || bulkBusy;

                      return (
                        <button
                          key={c.key}
                          type="button"
                          disabled={disabled}
                          onClick={() => setChoice(d.date, c.key)}
                          className={`rounded-lg border px-3 py-1 text-xs ${
                            active
                              ? "border-white/40 bg-white/10"
                              : "border-white/15 opacity-90 hover:bg-white/5"
                          } ${disabled ? "opacity-50" : ""}`}
                          title={c.key}
                        >
                          {c.label ?? c.key}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2 text-xs opacity-70">
                    Valgt: <span className="font-medium">{d.selected ? d.selected : "Ingen valgt"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) }
        </>
      )}

      {/* ✅ Påkrevd helge-CTA */}
      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-medium">Helgelevering (lørdag/søndag)</div>
        <div className="mt-1 text-sm opacity-80">Levering i helg bestilles ikke i Lunchportalen.</div>
        <a
          href="https://melhuscatering.no/catering/bestill-her/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
        >
          Bestill helgelevering
        </a>
      </div>
    </section>
  );
}
