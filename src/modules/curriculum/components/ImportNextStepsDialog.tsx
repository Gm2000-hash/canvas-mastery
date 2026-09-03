import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useAuth } from "@/modules/curriculum/config/auth";
import { useToast } from "@/modules/curriculum/config/toast";
import { NEXTSTEPS_LESSONS, type NextStepsLesson } from "@/modules/curriculum/lib/nextsteps-lessons-data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: { id: string; title: string; discipline: string }[];
  onImported: () => void;
}

const CATEGORIES = ["All", "Self-Evaluation", "Career Exploration", "Future Planning"] as const;

export function ImportNextStepsDialog({ open, onOpenChange, units, onImported }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [unitId, setUnitId] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  const careersUnits = units.filter(u => u.discipline === "Careers");

  const filtered = filter === "All"
    ? NEXTSTEPS_LESSONS
    : NEXTSTEPS_LESSONS.filter(l => l.category === filter);

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((_, i) => NEXTSTEPS_LESSONS.indexOf(filtered[i]))));
    }
  };

  const toggle = (globalIdx: number) => {
    const next = new Set(selected);
    next.has(globalIdx) ? next.delete(globalIdx) : next.add(globalIdx);
    setSelected(next);
  };

  const handleImport = async () => {
    if (!user || !unitId || selected.size === 0) return;
    setImporting(true);

    try {
      // Get current max sort_order for the unit
      const { data: existing } = await supabase
        .from("lesson_plans")
        .select("sort_order")
        .eq("unit_id", unitId)
        .order("sort_order", { ascending: false })
        .limit(1);

      let sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

      const rows = Array.from(selected).map(idx => {
        const lesson = NEXTSTEPS_LESSONS[idx];
        return {
          user_id: user.id,
          unit_id: unitId,
          title: lesson.title,
          objectives: lesson.description,
          materials: `Estimated time: ${lesson.estimatedTime}\nGrades: ${lesson.grades.join(", ")}${lesson.standard ? `\nStandard: ${lesson.standard}` : ""}`,
          notes: `Imported from Idaho NextSteps (nextsteps.idaho.gov/curriculum)\nCategory: ${lesson.category}`,
          sort_order: sortOrder++,
        };
      });

      const { error } = await supabase.from("lesson_plans").insert(rows);
      if (error) throw error;

      toast({ title: `Imported ${rows.length} lesson plans` });
      onImported();
      onOpenChange(false);
      setSelected(new Set());
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const categoryColor = (c: string) => {
    if (c === "Self-Evaluation") return "bg-blue-100 text-blue-800";
    if (c === "Career Exploration") return "bg-amber-100 text-amber-800";
    return "bg-green-100 text-green-800";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import NextSteps Lessons
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Import into Unit</Label>
            {careersUnits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Create a Careers unit first, then import.</p>
            ) : (
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue placeholder="Select a Careers unit..." /></SelectTrigger>
                <SelectContent>
                  {careersUnits.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Label className="shrink-0">Filter:</Label>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map(c => (
                <Badge
                  key={c}
                  variant={filter === c ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => { setFilter(c); setSelected(new Set()); }}
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={toggleAll} className="text-xs text-primary underline">
              {selected.size === filtered.length ? "Deselect all" : "Select all"} ({filtered.length})
            </button>
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 border rounded-lg">
          <div className="divide-y">
            {filtered.map((lesson, i) => {
              const globalIdx = NEXTSTEPS_LESSONS.indexOf(lesson);
              return (
                <label
                  key={globalIdx}
                  className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(globalIdx)}
                    onCheckedChange={() => toggle(globalIdx)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{lesson.title}</span>
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${categoryColor(lesson.category)}`}>
                        {lesson.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{lesson.description}</p>
                    <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>Grades: {lesson.grades.join(", ")}</span>
                      {lesson.standard && <span>• {lesson.standard}</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </ScrollArea>

        <Button
          onClick={handleImport}
          disabled={importing || !unitId || selected.size === 0}
          className="w-full gap-2"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Import {selected.size} Lesson{selected.size !== 1 ? "s" : ""}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
