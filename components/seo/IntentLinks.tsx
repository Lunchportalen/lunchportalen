// STATUS: KEEP

import Link from "next/link";

type Props = {
  currentPath: string;
  title?: string;
};

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/lunsjordning", label: "Se lunsjordning" },
  { href: "/hvordan", label: "Slik fungerer det" },
  { href: "/alternativ-til-kantine", label: "Alternativ til kantine" },
  { href: "/system-for-lunsjbestilling", label: "System for lunsjbestilling" },
  { href: "/lunsj-levering-oslo", label: "Lunsjordning i Oslo" },
  { href: "/lunsjordning-trondheim", label: "Lunsjordning i Trondheim" },
  { href: "/lunch-levering-bergen", label: "Lunsjordning i Bergen" },
  { href: "/hva-er-lunsjordning", label: "Hva er lunsjordning" },
  { href: "/definitiv-guide-firmalunsj", label: "Definitiv guide til firmalunsj" },
];

export default function IntentLinks({ currentPath, title = "Relaterte sider" }: Props) {
  const links = LINKS.filter((x) => x.href !== currentPath);

  return (
    <section className="lp-section" aria-label="Relaterte sider">
      <div className="lp-container">
        <div className="lp-section-head">
          <h2 className="lp-h2">{title}</h2>
          <p className="lp-sub">Gå direkte til sider med tydelig intensjon og beslutningsstøtte.</p>
        </div>

        <div className="lp-cta-row">
          {links.map((x) => (
            <Link key={x.href} className="lp-btn lp-btn-ghost" href={x.href}>
              {x.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
