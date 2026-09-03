import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";

/** Move an item within an array by offset (-1 = up, +1 = down) */
export function moveItem<T>(arr: T[], index: number, offset: -1 | 1): T[] {
  const next = index + offset;
  if (next < 0 || next >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

interface ReorderControlsProps {
  index: number;
  total: number;
  onMove: (offset: -1 | 1) => void;
  label: string;
}

export function ReorderControls({ index, total, onMove, label }: ReorderControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        title="Move up"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        disabled={index === total - 1}
        onClick={() => onMove(1)}
        title="Move down"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
