"use client";

import type { LocalizedMenuSurfacePresentation } from "@/lib/menu-generator/localizedMenuSurface";

type Props = {
  presentation: Extract<LocalizedMenuSurfacePresentation, { active: true }>;
};

export default function ProviderMenuLocalizedSurfaceBanner({ presentation }: Props) {
  const { packageCardMenuTerms } = presentation;

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
      <dl className="lp-editor-profile-presentation__packages" data-testid="provider-menu-package-terms">
        <div>
          <dt>Basis</dt>
          <dd data-testid="package-card-basis-includes">{packageCardMenuTerms.basisIncludes}</dd>
        </div>
        <div>
          <dt>Luxus</dt>
          <dd data-testid="package-card-luxus-includes">{packageCardMenuTerms.luxusIncludes}</dd>
        </div>
        <div>
          <dt>Enterprise</dt>
          <dd data-testid="package-card-enterprise-includes">{packageCardMenuTerms.enterpriseIncludes}</dd>
        </div>
      </dl>
      {presentation.fallbackWarning ? (
        <p className="lp-editor-profile-presentation__meta" role="status">
          {presentation.fallbackWarning}
        </p>
      ) : null}
    </aside>
  );
}
