import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, Circle, Loader2, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateReport } from "@/modules/curriculum/lib/textbook-chapter";

/**
 * Pass/fail badge for the fixed reading template. Click for the per-section
 * checklist and (optionally) a "Fix with AI" action that restructures the reading.
 */
export function TemplateBadge({ report, compact, onFix, fixing, className }: {
  report: TemplateReport;
  compact?: boolean;
  onFix?: () => void;
  fixing?: boolean;
  className?: string;
}) {
  const Icon = report.pass ? ShieldCheck : ShieldAlert;
  const tone = report.pass
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()} className={cn("inline-flex", className)} title="Reading template checks">
          <Badge variant="outline" className={cn("gap-1 font-normal cursor-pointer", compact ? "text-[10px] px-1.5 py-0" : "text-[11px]", tone)}>
            <Icon className="h-3 w-3" />
            {report.pass ? (compact ? "Template" : "Template ✓") : `${report.passed}/${report.total} sections`}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold mb-0.5">{report.pass ? "Follows the reading template" : "Doesn't match the reading template"}</p>
        <p className="text-xs text-muted-foreground mb-2">{report.passed} of {report.total} required sections pass{report.structured ? "" : " · old flat layout"}</p>
        <ul className="space-y-1.5">
          {report.checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-xs">
              {c.pass ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" /> : <Circle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />}
              <span className="flex-1">
                <span className={cn(c.pass ? "" : "font-medium")}>{c.label}</span>
                <span className="block text-muted-foreground">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        {!report.pass && onFix && (
          <Button size="sm" className="mt-3 w-full gap-1.5" onClick={onFix} disabled={fixing}>
            {fixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {fixing ? "Restructuring…" : "Fix with AI (restructure to template)"}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
