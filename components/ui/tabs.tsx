"use client";

import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

type TabsCtx = {
  value: string;
  setValue: (v: string) => void;
};

const TabsContext = React.createContext<TabsCtx | null>(null);

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const controlled = typeof value === "string";

  const current = controlled ? (value as string) : internal;

  const setValue = React.useCallback(
    (v: string) => {
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange]
  );

  const ctx = React.useMemo(() => ({ value: current, setValue }), [current, setValue]);

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export type TabsListProps = React.HTMLAttributes<HTMLDivElement>;

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-2xl p-1",
        "bg-[color:var(--lp-surface-2)] ring-1 ring-[color:var(--lp-border)]",
        "shadow-[var(--lp-shadow-sm)] [box-shadow:var(--lp-shadow-sm),var(--lp-shadow-inset)]",
        className
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({ className, value, children, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within <Tabs>.");

  const selected = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => ctx.setValue(value)}
      className={cn(
        "h-10 rounded-xl px-4 text-sm font-semibold",
        "transition-[transform,box-shadow,background-color,color,opacity] duration-200 [transition-timing-function:var(--lp-ease)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--lp-ring)]",
        selected
          ? "bg-[color:var(--lp-surface)] text-[color:var(--lp-fg)] shadow-[var(--lp-shadow-sm)]"
          : "text-[color:var(--lp-muted)] hover:bg-[color:var(--lp-surface)] hover:text-[color:var(--lp-fg)]",
        "active:scale-[0.99]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ className, value, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within <Tabs>.");

  if (ctx.value !== value) return null;

  return (
    <div
      role="tabpanel"
      className={cn("mt-4", className)}
      {...props}
    />
  );
}
