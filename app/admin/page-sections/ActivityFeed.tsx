export type ActivityFeedItem = {
  text: string;
  time: string;
  kind?: "success" | "soft" | "accent";
};

export default function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  return (
    <section className="ds-admin-card">
      <div className="ds-admin-card__head">
        <div>
          <h2 className="ds-admin-card__title">Aktivitet</h2>
          <p className="ds-admin-card__sub">Siste signaler fra drift</p>
        </div>
      </div>
      <div className="ds-admin-activity__list">
        {items.map((item) => (
          <div className="ds-admin-activity__item" key={`${item.text}-${item.time}`}>
            <div
              className={`ds-admin-activity__dot${
                item.kind === "success" ? " is-green" : item.kind === "soft" ? " is-soft" : ""
              }`}
            />
            <div>
              <div className="ds-admin-activity__text">{item.text}</div>
              <div className="ds-admin-activity__time">{item.time}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
