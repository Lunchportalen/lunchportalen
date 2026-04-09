"use client";

import { useState, type ReactNode } from "react";

import { ui } from "@/lib/ui/tokens";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={className}
      style={{
        padding: ui.spacing.md,
        borderRadius: ui.radius,
        boxShadow: ui.shadow,
        ...ui.glass,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        transform: hover ? "translateY(-3px) scale(1.01)" : "translateY(0) scale(1)",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
