import type { ReactNode } from "react";

export function PageBanner({
  greeting,
  subtitle,
  compact,
  children,
}: {
  greeting?: string;
  subtitle?: string;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-2 py-2"}>
      {greeting && <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting}</h1>}
      {subtitle && <p className="text-sm text-muted-foreground max-w-2xl">{subtitle}</p>}
      {children}
    </div>
  );
}
