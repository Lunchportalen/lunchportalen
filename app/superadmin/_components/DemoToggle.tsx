"use client";

import { useEffect, useState } from "react";

import { disableDemoMode, enableDemoMode, isDemoMode } from "@/lib/demo/mode";

export default function DemoToggle() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isDemoMode());
  }, []);

  return (
    <button
      type="button"
      onClick={() => (active ? disableDemoMode() : enableDemoMode())}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        padding: "10px 14px",
        borderRadius: 999,
        background: active ? "#dc2626" : "#111",
        color: "#fff",
        zIndex: 9999,
      }}
    >
      {active ? "Exit Demo" : "Start Demo"}
    </button>
  );
}
