"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
};

export default function AnimatedNumber({ value }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number.isFinite(value) ? Math.round(value) : 0;
    if (target === 0) {
      setDisplay(0);
      return;
    }

    let start = 0;
    const duration = 400;
    const step = target / (duration / 16);

    const interval = setInterval(() => {
      start += step;
      if (start >= target) {
        setDisplay(target);
        clearInterval(interval);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(interval);
  }, [value]);

  return <span className="tabular-nums">{display.toLocaleString("nb-NO")}</span>;
}
