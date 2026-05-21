import Link from "next/link";

const LINKS = [
  { href: "/superadmin/tripletex", label: "Oversikt" },
  { href: "/superadmin/tripletex/webhooks", label: "Webhooks" },
  { href: "/superadmin/tripletex/queue", label: "Kø" },
  { href: "/superadmin/tripletex/invoices", label: "Fakturaer" },
];

export default function TripletexSubNav({ activePath }: { activePath: string }) {
  return (
    <nav
      aria-label="Tripletex admin"
      className="flex flex-wrap justify-center gap-2 sm:justify-start"
    >
      {LINKS.map((item) => {
        const active =
          item.href === "/superadmin/tripletex"
            ? activePath === item.href
            : activePath === item.href || activePath.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "ds-btn min-h-[48px] rounded-full px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
              active ? "ds-btn--primary" : "ds-btn--secondary",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
