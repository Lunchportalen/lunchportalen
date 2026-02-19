// components/seo/RelatedLinks.tsx
import Link from "next/link";

type RelatedLink = {
  href: string;
  title: string;
  desc: string;
  badge?: string;
};

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

/**
 * Hvis du allerede har en datakilde i prosjektet ditt:
 * - behold den og bytt kun render-delen under (UI).
 *
 * Her ligger en enkel fallback-liste som matcher det du viser på skjermbildet.
 * Bytt gjerne til din eksisterende "getLinksByTags" om du har den.
 */
function getRelatedLinksByTags(tags: string[], currentPath: string): RelatedLink[] {
  const all: RelatedLink[] = [
    {
      href: "/lunsjordning",
      title: "Lunsjordning for bedrift",
      desc: "Fast ramme, mindre admin og mindre matsvinn – tydelig flyt for ansatte.",
      badge: "Kjerne",
    },
    {
      href: "/alternativ-til-kantine",
      title: "Alternativ til kantine",
      desc: "Kantine uten kjøkkeninvestering – strukturert lunsjløsning med kontroll.",
      badge: "Modell",
    },
    {
      href: "/system-for-lunsjbestilling",
      title: "System for lunsjbestilling",
      desc: "Digital lunsjportal med verifisert lagring og tydelig cut-off 08:00.",
      badge: "System",
    },
    {
      href: "/lunsj-levering-oslo",
      title: "Lunsj levering Oslo",
      desc: "Bedriftslunsj med fast ramme, cut-off 08:00 og full kontroll for admin.",
      badge: "Lokalt",
    },
    {
      href: "/lunsjordning-trondheim",
      title: "Lunsjordning Trondheim",
      desc: "Lunsj til ansatte med forutsigbar drift – mindre admin og mindre svinn.",
      badge: "Lokalt",
    },
    {
      href: "/lunch-levering-bergen",
      title: "Lunch levering Bergen",
      desc: "Lunchordning for firma – tydelig flyt, cut-off 08:00 og kontroll.",
      badge: "Lokalt",
    },
  ];

  // ✅ Filter bort current
  const out = all.filter((x) => x.href !== currentPath);

  // ✅ Hvis du bruker tags i ditt system, kan du filtrere her.
  // Her returnerer vi alle som “relevante”.
  void tags;

  return out.slice(0, 8);
}

export default function RelatedLinks({
  currentPath,
  tags,
  title = "Relaterte sider",
  subtitle = "Utforsk mer om lunsjordning, alternativ til kantine, system og lokale sider.",
}: {
  currentPath: string;
  tags: string[];
  title?: string;
  subtitle?: string;
}) {
  const links = getRelatedLinksByTags(tags, currentPath);

  if (!links.length) return null;

  return (
    <section className="lp-related" aria-label="Relaterte sider">
      <div className="lp-container">
        <div className="lp-related-head">
          <div>
            <h2 className="lp-h2 lp-related-title">{title}</h2>
            <p className="lp-sub lp-related-sub">{subtitle}</p>
          </div>
        </div>

        <div className="lp-related-grid">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx("lp-related-card", "lp-active-hover")}
              aria-label={`${item.title}. Les mer.`}
            >
              <div className="lp-related-card-top">
                {item.badge ? <span className="lp-related-badge">{item.badge}</span> : <span />}
                <span className="lp-related-arrow" aria-hidden="true">
                  →
                </span>
              </div>

              <div className="lp-related-h">{item.title}</div>
              <div className="lp-related-p">{item.desc}</div>

              <div className="lp-related-cta">
                <span className="lp-related-cta-text">Les mer</span>
                <span className="lp-related-cta-icon" aria-hidden="true">
                  ↗
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
