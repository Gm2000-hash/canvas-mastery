import { useState, useEffect } from "react";
import { useNavigate } from "@/modules/curriculum/config/router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSearchNotes } from "@/modules/curriculum/hooks/useNotes";
import {
  FileText, Home, BookOpen, Layers, Puzzle, Library, BookOpenCheck,
  BarChart3, ClipboardCheck,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TOOLS = [
  { label: "Dashboard", path: "/app", icon: Home },
  { label: "Question Bank", path: "/app/curriculum/question-bank", icon: BookOpen },
  { label: "Curriculum", path: "/app/curriculum/lesson-planner", icon: Layers },
  { label: "Activities", path: "/app/curriculum/activities", icon: Puzzle },
  { label: "Reading Library", path: "/app/curriculum/reading-library", icon: BookOpenCheck },
  { label: "Textbooks", path: "/app/curriculum/textbooks", icon: BookOpenCheck },
  { label: "Standards Browser", path: "/app/curriculum/standards", icon: Library },
  { label: "ISAT Practice", path: "/app/curriculum/question-bank?tab=isat", icon: ClipboardCheck },
  { label: "All Notes", path: "/app/curriculum/notes", icon: FileText },
];

export function CommandPalette({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { data: results = [] } = useSearchNotes(query);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search notes and tools…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Notes">
            {results.map((n: any) => (
              <CommandItem
                key={n.id}
                value={`note-${n.id}-${n.title}`}
                onSelect={() => go(`/app/curriculum/notes/${n.id}`)}
              >
                <span className="text-base mr-2 w-5 text-center">
                  {n.icon || <FileText className="h-4 w-4 inline" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{n.title || "Untitled"}</div>
                  {n.content_text && (
                    <div className="text-xs text-muted-foreground truncate">
                      {n.content_text.slice(0, 80)}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Tools">
          {TOOLS.map((t) => (
            <CommandItem
              key={t.path + t.label}
              value={`tool-${t.label}`}
              onSelect={() => go(t.path)}
            >
              <t.icon className="h-4 w-4 mr-2" />
              <span>{t.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
