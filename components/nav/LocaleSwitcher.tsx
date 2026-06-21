"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { APP_LOCALES, LP_LOCALE_COOKIE, type AppLocale } from "@/lib/i18n/middlewareLocale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function setLocaleCookie(locale: AppLocale) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LP_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

async function persistLocalePreference(locale: AppLocale, isAuthenticated: boolean) {
  if (!isAuthenticated) return;
  await fetch("/api/user/locale", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locale }),
    credentials: "same-origin",
  });
}

type LocaleSwitcherProps = {
  /** When true, POST /api/user/locale after cookie change. */
  persistProfile?: boolean;
  className?: string;
};

export default function LocaleSwitcher({ persistProfile = false, className }: LocaleSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("localeSwitcher");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const currentLabel = locale === "en" ? tNav("languageEn") : tNav("languageNb");

  async function onChange(nextRaw: string) {
    const next = APP_LOCALES.find((item) => item === nextRaw);
    if (!next || next === locale) return;

    setLocaleCookie(next);
    await persistLocalePreference(next, persistProfile);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <label className={["ds-locale-switcher", className].filter(Boolean).join(" ")}>
      <span className="sr-only">{t("label")}</span>
      <span className="sr-only" aria-live="polite">
        {t("current", { language: currentLabel })}
      </span>
      <select
        className="ds-locale-switcher__select"
        value={locale}
        disabled={pending}
        aria-label={t("label")}
        onChange={(event) => {
          void onChange(event.target.value);
        }}
      >
        <option value="nb">{tNav("languageNb")}</option>
        <option value="en">{tNav("languageEn")}</option>
      </select>
    </label>
  );
}
