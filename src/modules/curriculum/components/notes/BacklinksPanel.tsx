import { useNavigate } from "@/modules/curriculum/config/router";
import { useBacklinks } from "@/modules/curriculum/hooks/useNotes";
import { FileText, Link2 } from "lucide-react";

interface Props {
  noteId: string | undefined;
}

export function BacklinksPanel({ noteId }: Props) {
  const { data: backlinks = [] } = useBacklinks(noteId);
  const navigate = useNavigate();

  if (backlinks.length === 0) return null;

  return (
    <div className="border-t border-border/60 mt-8 pt-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        <Link2 className="h-3.5 w-3.5" /> Backlinks
      </div>
      <div className="flex flex-wrap gap-2">
        {backlinks.map((b: any) => (
          <button
            key={b.id}
            onClick={() => navigate(`/app/curriculum/notes/${b.id}`)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-accent text-sm transition-colors"
          >
            <span className="text-base">{b.icon || <FileText className="h-3.5 w-3.5 inline" />}</span>
            <span>{b.title || "Untitled"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
