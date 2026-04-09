"use client";

import type { Dispatch, SetStateAction } from "react";
import * as ShellUi from "./contentWorkspaceShellUiConstants";
import type { ContentSettingsTabKey } from "./ContentWorkspaceGlobalMainViewShell";

export type ContentWorkspaceGlobalMainViewShellContProps = {
  contentSettingsTab: ContentSettingsTabKey;
  emailPlatform: "campaignMonitor" | "mailchimp";
  setEmailPlatform: Dispatch<SetStateAction<"campaignMonitor" | "mailchimp">>;
  captchaVersion: "recaptchaV2" | "recaptchaV3" | "hcaptcha" | "turnstile";
  setCaptchaVersion: Dispatch<
    SetStateAction<"recaptchaV2" | "recaptchaV3" | "hcaptcha" | "turnstile">
  >;
  notificationEnabled: boolean;
  setNotificationEnabled: Dispatch<SetStateAction<boolean>>;
};

/**
 * Global workspace » Innhold og innstillinger: Skjema, globalt innhold, varsling, scripts, avansert + lagre-rad.
 * Props-only presentasjon; state eies i `ContentWorkspace.tsx` / presentation + overlays hooks.
 */
export function ContentWorkspaceGlobalMainViewShellCont({
  contentSettingsTab,
  emailPlatform,
  setEmailPlatform,
  captchaVersion,
  setCaptchaVersion,
  notificationEnabled,
  setNotificationEnabled,
}: ContentWorkspaceGlobalMainViewShellContProps) {
  return (
    <>
      {contentSettingsTab === "form" && (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="grid gap-4">
            <div className="grid gap-1">
              <span className="font-medium text-[rgb(var(--lp-text))]">Email marketing platform</span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                Hvære tilgjengelig.
              </span>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {ShellUi.EMAIL_PLATFORM_FORM_TAB_TUPLES.map(([value, label]) => {
                  const selected = emailPlatform === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEmailPlatform(value as "campaignMonitor" | "mailchimp")}
                      className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-3 text-xs font-medium ${selected
                        ? "border-slate-400 bg-slate-50 text-[rgb(var(--lp-text))]"
                        : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"
                        }`}
                    >
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">
                Email marketing platform API key
              </span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                Hvis tom vil nyhetsbrev-påmelding ikke være tilgjengelig.
              </span>
              <input
                type="text"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">
                Email marketing platform default subscriber list ID
              </span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                Brukes som standard liste for påmeldinger hvis ikke annet er angitt.
              </span>
              <input
                type="text"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
              />
            </label>

            <div className="grid gap-1">
              <span className="font-medium text-[rgb(var(--lp-text))]">CAPTCHA-versjon</span>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {ShellUi.CAPTCHA_VERSION_FORM_TAB_TUPLES.map(([value, label]) => {
                  const selected = captchaVersion === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setCaptchaVersion(
                          value as "recaptchaV2" | "recaptchaV3" | "hcaptcha" | "turnstile"
                        )
                      }
                      className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-medium ${selected
                        ? "border-slate-400 bg-slate-50 text-[rgb(var(--lp-text))]"
                        : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"
                        }`}
                    >
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">
              hCaptcha være aktiv på skjemaer hvis nøkkel og hemmelig nøkkel er lagt inn her.
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">hCaptcha site key</span>
              <input
                type="text"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">hCaptcha secret key</span>
              <input
                type="text"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
              />
            </label>
          </div>
        </div>
      )}

      {contentSettingsTab === "globalContent" && (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-[rgb(var(--lp-muted))]">
            Innhold som legges til her vil vises på alle sider, med mindre det overstyres på sidenivå.
          </div>
          <div className="space-y-4">
            {ShellUi.GLOBAL_CONTENT_TOP_BOTTOM_PODS_ROWS.map(([label, cta]) => (
              <div key={label} className="grid gap-1 text-sm">
                <span className="font-medium text-[rgb(var(--lp-text))]">{label}</span>
                <button
                  type="button"
                  className="mt-1 flex min-h-[44px] items-center justify-between rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                >
                  <span>{cta}</span>
                </button>
              </div>
            ))}

            <div className="grid gap-2">
              <span className="font-medium text-[rgb(var(--lp-text))]">Modal window</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {ShellUi.GLOBAL_MODAL_TIMING_LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border border-[rgb(var(--lp-border))] bg-white text-xs font-medium text-[rgb(var(--lp-muted))]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {contentSettingsTab === "notification" && (
        <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[rgb(var(--lp-text))]">Enable</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Slå på for å vise globale varsler på nettstedet.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationEnabled}
              onClick={() => setNotificationEnabled((v) => !v)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${notificationEnabled ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${notificationEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
              />
            </button>
          </div>
        </div>
      )}

      {contentSettingsTab === "scripts" && (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          {ShellUi.GLOBAL_SCRIPT_INJECTION_SECTION_TUPLES.map(([label, helper]) => (
            <div key={label} className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">{label}</span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                {helper} Husk å pakke JavaScript i {"<script>"}-tagger.
              </span>
              <textarea
                rows={4}
                className="mt-1 w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
              />
            </div>
          ))}
        </div>
      )}

      {contentSettingsTab === "advanced" && (
        <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[rgb(var(--lp-text))]">Disable delete</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Hvis aktivert, blokkeres sletting av denne noden og en advarsel vises.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              YES
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
        <p className="text-xs text-[rgb(var(--lp-muted))]">Global / Innhold og innstillinger</p>
        <div className="flex gap-2">
          <button type="button" className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-green-700 hover:bg-slate-50">
            Lagre
          </button>
          <button type="button" className="min-h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700">
            Lagre og publiser
          </button>
        </div>
      </div>
    </>
  );
}
