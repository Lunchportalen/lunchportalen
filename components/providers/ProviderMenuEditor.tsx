"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  CATEGORY_LABELS,
  PLAN_CATEGORIES,
  PLAN_TIERS,
  type Category,
  type PlanTier,
} from "@/lib/cms/menuDayContract";
import { resolveProviderMenuApiError } from "@/lib/providers/providerMenuActionErrors";

type FormStatus = "idle" | "loading" | "saved" | "published" | "error";

type MenuDayApiResponse = {
  ok: boolean;
  rid?: string;
  data?: {
    id: string;
    providerSlug: string;
    providerName: string;
    date: string;
    tier: string;
    category: string;
    mealTitle: string;
    status: "draft" | "published";
    approvedForPublish: boolean;
    customerVisible: boolean;
    syncStatus: string;
  };
  message?: string;
  error?: string;
};

const TIER_LABELS: Record<PlanTier, string> = {
  BASIS: "Basis",
  LUXUS: "Luxus",
  ENTERPRISE: "Enterprise",
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ProviderMenuEditor() {
  const t = useTranslations("provider.menu");
  const [tier, setTier] = useState<PlanTier>("BASIS");
  const [category, setCategory] = useState<Category>("varmrett");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<MenuDayApiResponse["data"] | null>(null);
  const [pending, startTransition] = useTransition();

  const categories = useMemo(() => PLAN_CATEGORIES[tier], [tier]);

  function onTierChange(next: PlanTier) {
    setTier(next);
    const allowed = PLAN_CATEGORIES[next];
    if (!allowed.includes(category)) {
      setCategory(allowed[0] ?? "varmrett");
    }
  }

  async function submit(status: "draft" | "published", form: HTMLFormElement) {
    const fd = new FormData(form);
    const payload = {
      date: String(fd.get("date") ?? ""),
      tier,
      category,
      mealTitle: String(fd.get("mealTitle") ?? ""),
      description: String(fd.get("description") ?? ""),
      allergensText: String(fd.get("allergensText") ?? "") || null,
      status,
    };

    setStatus("loading");
    setMessage(null);
    setResult(null);

    try {
      const res = await fetch("/api/provider/menu-days", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as MenuDayApiResponse;

      if (!res.ok || !json.ok || !json.data) {
        setStatus("error");
        setMessage(resolveProviderMenuApiError(t, json, "saveFailed"));
        return;
      }

      setResult(json.data);
      setStatus(status === "published" ? "published" : "saved");
      setMessage(status === "published" ? t("success.published") : t("success.draftSaved"));
    } catch {
      setStatus("error");
      setMessage(t("errors.saveFailed"));
    }
  }

  function onPublish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => submit("published", event.currentTarget));
  }

  const statusClass =
    status === "saved" || status === "published"
      ? "is-success"
      : status === "error"
        ? "is-error"
        : "";

  return (
    <section className="ds-card ds-provider-meny-card">
      <p className="ds-body">
        For at ansatte skal kunne bestille må firmaet ha aktiv avtale, og menyen må være publisert.
      </p>

      <form className="lp-demo-form ds-provider-meny-form" onSubmit={onPublish} noValidate>
        <label htmlFor="menu-date">Dato</label>
        <input id="menu-date" name="date" type="date" required defaultValue={todayIso()} />

        <label htmlFor="menu-tier">Plan</label>
        <select
          id="menu-tier"
          name="tier"
          value={tier}
          onChange={(e) => onTierChange(e.target.value as PlanTier)}
          required
        >
          {PLAN_TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </select>

        <label htmlFor="menu-category">Kategori</label>
        <select
          id="menu-category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          required
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>

        <label htmlFor="menu-meal-title">Rettens navn</label>
        <input id="menu-meal-title" name="mealTitle" type="text" required maxLength={120} />

        <label htmlFor="menu-description">Beskrivelse</label>
        <textarea id="menu-description" name="description" rows={4} required maxLength={4000} />

        <label htmlFor="menu-allergens">Allergener (valgfritt, kommaseparert)</label>
        <textarea
          id="menu-allergens"
          name="allergensText"
          rows={2}
          maxLength={2000}
          placeholder="F.eks. melk, hvete"
        />

        {message ? (
          <p className={`lp-demo-form__status ${statusClass}`} role="status" aria-live="polite">
            {message}
          </p>
        ) : null}

        {result ? (
          <div className="ds-provider-meny-result" role="status">
            <p className="ds-body">
              <strong>{result.mealTitle}</strong>
            </p>
            <p className="ds-body ds-provider-meny-result__meta">
              {result.date} · {TIER_LABELS[result.tier as PlanTier] ?? result.tier} ·{" "}
              {CATEGORY_LABELS[result.category as Category] ?? result.category}
            </p>
          </div>
        ) : null}

        <div className="ds-provider-meny-actions">
          <button
            type="button"
            className="ds-btn"
            disabled={pending || status === "loading"}
            onClick={(e) => {
              const form = (e.currentTarget as HTMLButtonElement).form;
              if (form) startTransition(() => submit("draft", form));
            }}
          >
            {pending && status === "loading" ? "Lagrer…" : "Lagre utkast"}
          </button>
          <button type="submit" className="ds-btn ds-btn--primary" disabled={pending || status === "loading"}>
            {pending && status === "loading" ? "Publiserer…" : "Publiser meny"}
          </button>
        </div>
      </form>
    </section>
  );
}
