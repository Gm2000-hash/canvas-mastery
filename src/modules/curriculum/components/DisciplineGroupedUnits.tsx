import { useState } from "react";
import { NavigateFunction } from "@/modules/curriculum/config/router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, FileText, Copy, GripVertical, Trash2, ChevronDown, ChevronRight, Beaker, Globe, Zap, Wrench, Briefcase } from "lucide-react";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";

interface Unit {
  id: string;
  title: string;
  description: string;
  grade_level: string;
  discipline: string;
  date_start: string | null;
  date_end: string | null;
  created_at: string;
  lesson_count?: number;
}

const DISCIPLINE_META: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "Life Science", label: "Life Science", icon: Beaker },
  { key: "Physical Science", label: "Physical Science", icon: Zap },
  { key: "Earth & Space Science", label: "Earth & Space Science", icon: Globe },
  { key: "Engineering", label: "Engineering", icon: Wrench },
  { key: "Careers", label: "Careers", icon: Briefcase },
];

interface Props {
  units: Unit[];
  navigate: NavigateFunction;
  onDuplicate: (unit: Unit) => void;
  onDelete: (id: string, title: string) => void;
  dragIdx: number | null;
  overIdx: number | null;
  onDragStart: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
}

export function DisciplineGroupedUnits({ units, navigate, onDuplicate, onDelete, dragIdx, overIdx, onDragStart, onDragEnd, onDragOver }: Props) {
  // Group units by discipline
  const groups = DISCIPLINE_META.map(meta => ({
    ...meta,
    units: units.filter(u => u.discipline === meta.key),
  })).filter(g => g.units.length > 0);

  // Ungrouped units (no discipline or unrecognized)
  const knownKeys = new Set(DISCIPLINE_META.map(m => m.key));
  const ungrouped = units.filter(u => !u.discipline || !knownKeys.has(u.discipline));

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const renderUnit = (unit: Unit, globalIdx: number) => (
    <div
      key={unit.id}
      draggable
      onDragStart={e => onDragStart(e, globalIdx)}
      onDragEnd={onDragEnd}
      onDragOver={e => onDragOver(e, globalIdx)}
      onDragEnter={e => e.preventDefault()}
      className={`transition-all duration-150 ${
        overIdx === globalIdx && dragIdx !== null && dragIdx !== globalIdx
          ? "ring-2 ring-dashed ring-primary/40 rounded-xl"
          : ""
      }`}
    >
      <Card
        className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
        onClick={() => navigate(`/app/curriculum/units/${unit.id}`)}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div
            className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors touch-none"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{unit.title}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {unit.grade_level && <span>{unit.grade_level}</span>}
              {unit.grade_level && <span>•</span>}
              <span>{unit.lesson_count || 0} lessons</span>
              {unit.date_start && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(unit.date_start), "MMM d")}
                    {unit.date_end && ` – ${format(new Date(unit.date_end), "MMM d")}`}
                  </span>
                </>
              )}
            </div>
            {unit.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{unit.description}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 rounded-xl text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
              <DropdownMenuItem className="gap-2" onClick={() => onDuplicate(unit)}>
                <Copy className="h-3.5 w-3.5" /> Duplicate Unit
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => onDelete(unit.id, unit.title)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete Unit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      {groups.map(group => {
        const Icon = group.icon;
        const isCollapsed = collapsed[group.key] ?? false;
        const totalLessons = group.units.reduce((s, u) => s + (u.lesson_count || 0), 0);

        return (
          <div key={group.key} className="rounded-2xl border bg-card overflow-hidden">
            <button
              onClick={() => toggle(group.key)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">{group.label}</h3>
                <p className="text-xs text-muted-foreground">{group.units.length} unit{group.units.length !== 1 ? "s" : ""} · {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}</p>
              </div>
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>
            {!isCollapsed && (
              <div className="px-3 pb-3 grid gap-2">
                {group.units.map(unit => {
                  const globalIdx = units.indexOf(unit);
                  return renderUnit(unit, globalIdx);
                })}
              </div>
            )}
          </div>
        );
      })}

      {ungrouped.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 py-3">
            <h3 className="font-semibold text-foreground text-sm">Other</h3>
            <p className="text-xs text-muted-foreground">{ungrouped.length} unit{ungrouped.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="px-3 pb-3 grid gap-2">
            {ungrouped.map(unit => {
              const globalIdx = units.indexOf(unit);
              return renderUnit(unit, globalIdx);
            })}
          </div>
        </div>
      )}
    </div>
  );
}
