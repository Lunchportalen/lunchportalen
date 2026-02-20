"use client";

import { useEffect } from "react";

export default function DevOverflowGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const check = () => {
      const doc = document.documentElement;
      if (!doc) return;
      const overflow = doc.scrollWidth > window.innerWidth + 1;
      if (overflow) {
        // eslint-disable-next-line no-console
        console.warn(
          `[overflow] scrollWidth=${doc.scrollWidth} > innerWidth=${window.innerWidth}`
        );
      }
    };

    check();
    const t = window.setTimeout(check, 250);
    window.addEventListener("resize", check);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", check);
    };
  }, []);

  return null;
}
