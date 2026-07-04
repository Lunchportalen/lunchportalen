"use client";

import type { LocalizedMenuSurfacePresentation } from "@/lib/menu-generator/localizedMenuSurface";

type Props = {
  presentation: Extract<LocalizedMenuSurfacePresentation, { active: true }>;
};

export default function ProviderMenuLocalizedSurfaceBanner({ presentation }: Props) {
  return (
    <aside
      className="lp-editor-profile-presentation"
      data-testid="provider-menu-localized-surface-banner"
      role="note"
    >
      <p className="lp-editor-profile-presentation__badge">Menyinnhold</p>
      <p className="lp-editor-profile-presentation__banner">
        Kategorier og faste valg styres av provider menuLocale — ikke UI-språk.
      </p>
      <p className="lp-editor-profile-presentation__meta">
        Menyprofil: {presentation.profileName} · {presentation.menuLocale}
      </p>
      {presentation.fallbackWarning ? (
        <p className="lp-editor-profile-presentation__meta" role="status">
          {presentation.fallbackWarning}
        </p>
      ) : null}
    </aside>
  );
}
