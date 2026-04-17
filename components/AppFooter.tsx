// components/AppFooter.tsx
import AppFooterView from "@/components/AppFooterView";
import { getGlobalFooter } from "@/lib/content/getGlobalFooter";
import { marketingFooterInnerClass, type ParsedDesignSettings } from "@/lib/cms/design/designContract";
import { footerShellViewModelFromCmsJson } from "@/lib/layout/globalFooterFromCms";
import { getFooterVariantClass, type FooterVariant } from "@/lib/ui/footerVariants";

type ContainerMode = "container" | "full";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** Shared footer shell. Pass variant for lp-footer-* (glass/soft/gradient/outline/glow); omit for default. Structure: lp-footer lp-footer--full from globals. */
export default async function AppFooter({
  containerMode = "container",
  variant,
  designSettings = null,
}: {
  containerMode?: ContainerMode;
  /** Visual variant (lib/ui/footerVariants); omit for default footer look */
  variant?: FooterVariant;
  /** Published global design — inner width matches CMS `layout.container`. */
  designSettings?: ParsedDesignSettings | null;
}) {
  const innerMaxClassName =
    designSettings != null ?
      marketingFooterInnerClass(designSettings, containerMode)
    : containerMode === "full" ?
      "lp-footer-shell"
    : "lp-footer-shell lp-max-1400";
  const footerClassName = cn("lp-footer lp-footer--full", getFooterVariantClass(variant));

  const cmsJson = await getGlobalFooter();
  const footerModel = footerShellViewModelFromCmsJson(cmsJson);

  return <AppFooterView {...footerModel} footerClassName={footerClassName} innerMaxClassName={innerMaxClassName} />;
}
