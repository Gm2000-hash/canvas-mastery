import { useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

type Course = { id: string; name: string };

interface Props {
  courses: Course[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Reusable checkbox-based multi-select for courses, used in the Compare tab
 * and as a filter on the Assessments / Standards tabs of Analytics.
 */
export function CourseMultiSelect({ courses, selected, onChange, placeholder = "All classes", className }: Props) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === courses.length
      ? `All classes (${courses.length})`
      : selected.length <= 2
      ? courses.filter((c) => selectedSet.has(c.id)).map((c) => c.name).join(", ")
      : `${selected.length} classes selected`;

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={`h-9 justify-between font-normal min-w-[220px] ${className ?? ""}`}>
          <span className="truncate">{summary}</span>
          <ChevronsUpDown className="h-3 w-3 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <div className="flex items-center justify-between px-1 pb-2 border-b mb-1">
          <button
            type="button"
            onClick={() => onChange(courses.map((c) => c.id))}
            className="text-xs hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground hover:underline"
          >
            Clear
          </button>
        </div>
        <ScrollArea className="max-h-72">
          <ul className="space-y-0.5">
            {courses.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">No classes available.</li>
            )}
            {courses.map((c) => {
              const checked = selectedSet.has(c.id);
              return (
                <li key={c.id}>
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(c.id)} />
                    <span className="truncate flex-1">{c.name}</span>
                    {checked && <Check className="h-3 w-3 text-primary" />}
                  </label>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default CourseMultiSelect;
