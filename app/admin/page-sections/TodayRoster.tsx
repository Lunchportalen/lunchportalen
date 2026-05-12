export type TodayRosterItem = {
  name: string;
  meta: string;
  status: string;
  statusKind?: "ok" | "warn";
  initials: string;
};

export default function TodayRoster({ items }: { items: TodayRosterItem[] }) {
  return (
    <section className="ds-admin-card">
      <div className="ds-admin-card__head">
        <div>
          <h2 className="ds-admin-card__title">Dagens drift</h2>
          <p className="ds-admin-card__sub">Operativt bilde for firmaet i dag</p>
        </div>
      </div>
      <div className="ds-admin-people__list">
        {items.map((item) => (
          <div className="ds-admin-people__item" key={`${item.name}-${item.meta}`}>
            <div className="ds-admin-people__avatar">{item.initials}</div>
            <div className="ds-admin-people__info">
              <div className="ds-admin-people__name">{item.name}</div>
              <div className="ds-admin-people__meta">{item.meta}</div>
            </div>
            <div className={`ds-admin-people__status${item.statusKind === "warn" ? " is-warn" : " is-ok"}`}>
              {item.status}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
