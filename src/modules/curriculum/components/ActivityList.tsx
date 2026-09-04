import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, GripVertical } from "lucide-react";

interface Activity {
  name: string;
  duration: number;
  description: string;
  /** Kolb experiential-learning stage (set by the AI generators). */
  type?: string;
  /** "Why this works" instructional rationale. */
  rationale?: string;
}

export const KOLB_STAGE_LABELS: Record<string, string> = {
  concrete_experience: "Concrete Experience",
  reflective_observation: "Reflective Observation",
  abstract_conceptualization: "Abstract Conceptualization",
  active_experimentation: "Active Experimentation",
};

interface Props {
  activities: Activity[];
  onReorder: (activities: Activity[]) => void;
  onUpdate: (idx: number, field: keyof Activity, value: string | number) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
}

export function ActivityList({ activities, onReorder, onUpdate, onRemove, onAdd }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    dragNode.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    requestAnimationFrame(() => {
      if (dragNode.current) dragNode.current.style.opacity = "0.4";
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNode.current) dragNode.current.style.opacity = "1";
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const reordered = [...activities];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(overIdx, 0, moved);
      onReorder(reordered);
    }
    setDragIdx(null);
    setOverIdx(null);
    dragNode.current = null;
  }, [dragIdx, overIdx, activities, onReorder]);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, []);

  return (
    <div className="space-y-2">
      {activities.map((act, idx) => (
        <div
          key={idx}
          draggable
          onDragStart={e => handleDragStart(e, idx)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOver(e, idx)}
          onDragEnter={e => e.preventDefault()}
          className={`flex gap-2 items-start p-3 rounded-xl transition-all duration-150 ${
            overIdx === idx && dragIdx !== null && dragIdx !== idx
              ? "bg-primary/10 border-2 border-dashed border-primary/40"
              : "bg-[#f59f0a]/[0.66]"
          } ${dragIdx === idx ? "opacity-40" : ""}`}
        >
          <div
            className="shrink-0 mt-1.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors touch-none"
            onMouseDown={e => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Activity name"
                value={act.name}
                onChange={e => onUpdate(idx, "name", e.target.value)}
                className="text-sm h-8"
              />
              <Input
                type="number"
                value={act.duration}
                onChange={e => onUpdate(idx, "duration", parseInt(e.target.value) || 0)}
                className="w-20 text-sm h-8"
                placeholder="min"
              />
            </div>
            {act.type && KOLB_STAGE_LABELS[act.type] && (
              <span className="inline-flex items-center rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                Kolb: {KOLB_STAGE_LABELS[act.type]}
              </span>
            )}
            <Textarea
              placeholder="Description..."
              value={act.description}
              onChange={e => onUpdate(idx, "description", e.target.value)}
              rows={2}
              className="text-sm"
            />
            {(act.rationale !== undefined || act.type) && (
              <Textarea
                placeholder="Why this works (rationale)…"
                value={act.rationale ?? ""}
                onChange={e => onUpdate(idx, "rationale", e.target.value)}
                rows={1}
                className="text-xs italic text-muted-foreground bg-background/50"
              />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(idx)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full rounded-xl gap-1.5" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" /> Add Activity
      </Button>
    </div>
  );
}
