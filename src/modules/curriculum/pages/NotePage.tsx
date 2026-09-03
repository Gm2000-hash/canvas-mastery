import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "@/modules/curriculum/config/router";
import { useNote, useNotesTree, useUpdateNote, useReplaceNoteLinks } from "@/modules/curriculum/hooks/useNotes";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BacklinksPanel } from "@/modules/curriculum/components/notes/BacklinksPanel";
import { ShareDialog } from "@/modules/curriculum/components/ShareDialog";
import { Share2, Smile, X, Loader2 } from "lucide-react";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { toast } from "sonner";

const EMOJI_OPTIONS = ["📝", "📚", "🎓", "💡", "🔬", "🧪", "🧮", "📊", "📅", "✏️", "🎨", "🎯", "🌟", "🔥", "❤️", "🌱", "🪐", "🧠", "🗂️", "📌"];

function extractText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").trim();
}

function extractWikiLinks(html: string): string[] {
  const matches = html.match(/\[\[([^\]]+)\]\]/g) ?? [];
  return matches.map((m) => m.slice(2, -2).trim()).filter(Boolean);
}

function extractTags(html: string): string[] {
  const text = extractText(html);
  const matches = text.match(/(?:^|\s)#([a-zA-Z0-9_-]+)/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.trim().slice(1).toLowerCase())));
}

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const { data: note, isLoading } = useNote(id);
  const { data: allNotes = [] } = useNotesTree();
  const updateNote = useUpdateNote();
  const replaceLinks = useReplaceNoteLinks();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const lastSaved = useRef<{ title: string; content: string; icon: string | null } | null>(null);

  usePageTitle(title || "Note");

  // Initial load
  useEffect(() => {
    if (note) {
      const initialContent = (note.content as any)?.html ?? "";
      setTitle(note.title);
      setContent(initialContent);
      setIcon(note.icon);
      setTags(note.tags ?? []);
      lastSaved.current = { title: note.title, content: initialContent, icon: note.icon };
    }
  }, [note?.id]);

  // Title -> notes lookup for wiki-link resolution
  const titleMap = useMemo(() => {
    const map = new Map<string, string>();
    allNotes.forEach((n) => map.set((n.title || "").toLowerCase().trim(), n.id));
    return map;
  }, [allNotes]);

  // Debounced save
  useEffect(() => {
    if (!id || !note) return;
    if (
      lastSaved.current &&
      lastSaved.current.title === title &&
      lastSaved.current.content === content &&
      lastSaved.current.icon === icon
    ) return;

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const text = extractText(content);
      const newTags = extractTags(content);
      const wikiTitles = extractWikiLinks(content);
      const linkedIds = wikiTitles
        .map((t) => titleMap.get(t.toLowerCase()))
        .filter((x): x is string => !!x && x !== id);

      try {
        await updateNote.mutateAsync({
          id,
          updates: {
            title: title || "Untitled",
            content: { html: content } as any,
            content_text: text,
            tags: newTags,
            icon,
          },
        });
        await replaceLinks.mutateAsync({ sourceId: id, targetIds: Array.from(new Set(linkedIds)) });
        setTags(newTags);
        lastSaved.current = { title, content, icon };
      } catch (e: any) {
        toast.error("Auto-save failed: " + (e.message ?? "unknown error"));
      }
    }, 800);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [title, content, icon, id, note, titleMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-muted-foreground">Note not found.</p>
        <Button onClick={() => navigate("/app/curriculum/notes")} variant="outline" className="mt-4">
          Back to notes
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-12 w-12 text-3xl">
              {icon || <Smile className="h-5 w-5 text-muted-foreground" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="grid grid-cols-6 gap-1">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  className="h-8 w-8 text-xl rounded hover:bg-accent"
                  onClick={() => setIcon(e)}
                >
                  {e}
                </button>
              ))}
              <button
                className="h-8 w-8 rounded hover:bg-accent flex items-center justify-center text-muted-foreground"
                onClick={() => setIcon(null)}
                title="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} className="gap-2">
          <Share2 className="h-4 w-4" />
          {note.is_public ? "Shared" : "Share"}
        </Button>
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        className="!text-4xl font-bold border-0 px-0 h-auto py-2 bg-transparent focus-visible:ring-0 shadow-none"
      />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">
              #{t}
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-2 mb-6">
        Tip: type <code className="bg-muted px-1 rounded">[[Page Title]]</code> to link pages, or <code className="bg-muted px-1 rounded">#tag</code> to add a tag.
      </p>

      <RichTextEditor
        content={content}
        onChange={setContent}
        placeholder="Start writing…"
      />

      <BacklinksPanel noteId={id} />
    </div>
  );
}
