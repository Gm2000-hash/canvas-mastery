import { useEffect, useState } from "react";
import { useParams } from "@/modules/curriculum/config/router";
import { supabase } from "@/modules/curriculum/config/supabase";
import { Loader2, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { format } from "date-fns";
import { sanitizeRichHtml } from "@/modules/curriculum/lib/sanitize-rich-html";

interface SharedNoteData {
  id: string;
  title: string;
  icon: string | null;
  content: any;
  tags: string[];
  updated_at: string;
  author_display_name: string;
}

export default function SharedNote() {
  const { token } = useParams<{ token: string }>();
  const [note, setNote] = useState<SharedNoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageTitle(note?.title || "Shared note");

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_shared_note", { _token: token });
      if (error) {
        setError(error.message);
      } else if (!data || (data as any[]).length === 0) {
        setError("This page is not available.");
      } else {
        setNote((data as any[])[0] as SharedNoteData);
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Page unavailable</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const rawHtml = (note.content as any)?.html ?? "";
  const html = sanitizeRichHtml(rawHtml);

  return (
    <div className="min-h-screen bg-background">
      <header className="h-12 border-b border-border/60 bg-card flex items-center px-4 gap-2">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <GraduationCap className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold">Teaching Toolkit</span>
        <span className="text-xs text-muted-foreground ml-auto">Shared page</span>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-5xl mb-4">{note.icon || "📝"}</div>
        <h1 className="text-4xl font-bold mb-2">{note.title || "Untitled"}</h1>
        <p className="text-xs text-muted-foreground mb-4">
          {note.author_display_name && <>by {note.author_display_name} · </>}
          Updated {format(new Date(note.updated_at), "MMM d, yyyy")}
        </p>
        {note.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {note.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">#{t}</Badge>
            ))}
          </div>
        )}
        <div
          className="prose prose-sm max-w-none mt-6"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </div>
  );
}
