"use client";

import { useId, useState, type ReactNode } from "react";

export default function ProviderDetailAccordionSection(props: {
  title: string;
  badges?: ReadonlyArray<string>;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { title, badges = [], defaultOpen = false, children } = props;
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const buttonId = useId();

  return (
    <section className="ds-provider-accordion">
      <h2 className="ds-provider-accordion__heading">
        <button
          id={buttonId}
          type="button"
          className="ds-provider-accordion__trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="ds-provider-accordion__title">{title}</span>
          {badges.length > 0 ? (
            <span className="ds-provider-accordion__badges">
              {badges.map((badge) => (
                <span key={badge} className="ds-provider-accordion__badge">
                  {badge}
                </span>
              ))}
            </span>
          ) : null}
          <span className="ds-provider-accordion__chevron" aria-hidden="true">
            {open ? "−" : "+"}
          </span>
        </button>
      </h2>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`ds-provider-accordion__panel${open ? " is-open" : ""}`}
        hidden={!open}
      >
        {children}
      </div>
    </section>
  );
}
