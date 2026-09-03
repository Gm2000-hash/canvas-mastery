import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type HeroAction = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  variant?: string;
};

type SideTile = {
  variant?: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  action?: HeroAction;
};

export function BentoHero({
  eyebrow,
  title,
  subtitle,
  stats,
  primaryAction,
  secondaryAction,
  secondaryActions,
  sideTiles,
}: {
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: string;
  stats?: { label: string; value: number | string }[];
  primaryAction?: HeroAction;
  secondaryAction?: HeroAction;
  secondaryActions?: HeroAction[];
  sideTiles?: SideTile[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3 max-w-xl">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
          )}
          {title && <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{title}</h1>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {(primaryAction || secondaryAction || (secondaryActions && secondaryActions.length > 0)) && (
            <div className="flex flex-wrap gap-2 pt-2">
              {primaryAction && (
                <Button onClick={primaryAction.onClick} className="gap-2">
                  {primaryAction.icon && <primaryAction.icon className="h-4 w-4" />}
                  {primaryAction.label}
                </Button>
              )}
              {secondaryActions?.map((a) => (
                <Button key={a.label} variant="outline" onClick={a.onClick} className="gap-2">
                  {a.icon && <a.icon className="h-4 w-4" />}
                  {a.label}
                </Button>
              ))}
              {secondaryAction && (
                <Button variant="outline" onClick={secondaryAction.onClick} className="gap-2">
                  {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4" />}
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {stats && stats.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:col-span-2">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl bg-muted px-4 py-3 text-center">
                  <div className="text-xl font-bold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {sideTiles?.map((t, i) => (
            <div key={i} className="rounded-xl border border-border bg-background p-4">
              {t.eyebrow && <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t.eyebrow}</p>}
              {t.title && <p className="mt-1 text-sm font-semibold text-foreground">{t.title}</p>}
              {t.body && <p className="mt-1 text-xs text-muted-foreground">{t.body}</p>}
              {t.action && (
                <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={t.action.onClick}>
                  {t.action.icon && <t.action.icon className="h-3.5 w-3.5" />}
                  {t.action.label}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
