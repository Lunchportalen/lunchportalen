"use client";

import { useEffect, useState } from "react";

import { demoSteps } from "@/lib/demo/steps";
import { useDemoModeActive } from "@/lib/demo/useDemoModeActive";

export default function DemoStory() {
  const demo = useDemoModeActive();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!demo) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % demoSteps.length);
    }, 5000);
    return () => window.clearInterval(t);
  }, [demo]);

  if (!demo) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#111",
        color: "#fff",
        padding: 16,
        borderRadius: 10,
        zIndex: 9999,
        maxWidth: "min(560px, calc(100vw - 32px))",
        textAlign: "center",
        fontSize: 14,
        lineHeight: 1.4,
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
      }}
    >
      <span aria-hidden>🚀</span> {demoSteps[idx] ?? demoSteps[0]}
    </div>
  );
}
