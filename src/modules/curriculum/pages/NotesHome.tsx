import { useNavigate } from "@/modules/curriculum/config/router";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  useNotesTree,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
} from "@/modules/curriculum/hooks/useNotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  FileText,
  StickyNote,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { NoteTreeItem } from "@/modules/curriculum/hooks/useNotes";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";

type Bucket = {
  key: string;
  label: string;
  notes: NoteTreeItem[];
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function bucketize(notes: NoteTreeItem[]): Bucket[] {
  const now = new Date();
  const wk = startOfWeek(now).getTime();
  const mo = startOfMonth(now).getTime();
  const yr = startOfYear(now).getTime();

  const buckets: Record<string, Bucket> = {
    week:  { key: "week",  label: "This week",  notes: [] },
    month: { key: "month", label: "This month", notes: [] },
    year:  { key: "year",  label: "This year",  notes: [] },
  };
  const olderByYear: Record<number, NoteTreeItem[]> = {};

  const sorted = [...notes].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  for (const n of sorted) {
    const t = new Date(n.updated_at).getTime();
    if (t >= wk) buckets.week.notes.push(n);
    else if (t >= mo) buckets.month.notes.push(n);
    else if (t >= yr) buckets.year.notes.push(n);
    else {
      const y = new Date(n.updated_at).getFullYear();
      (olderByYear[y] = olderByYear[y] || []).push(n);
    }
  }

  const out: Bucket[] = [];
  if (buckets.week.notes.length)  out.push(buckets.week);
  if (buckets.month.notes.length) out.push(buckets.month);
  if (buckets.year.notes.length)  out.push(buckets.year);
  Object.keys(olderByYear)
    .map(Number)
    .sort((a, b) => b - a)
    .forEach((y) => out.push({ key: `y-${y}`, label: String(y), notes: olderByYear[y] }));

  return out;
}

function extractText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").trim();
}

export default function NotesHome() {
  usePageTitle("Notes");
  const navigate = useNavigate();
  const { data: notes = [] } = useNotesTree();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const buckets = useMemo(() => bucketize(notes), [notes]);

  // Inline-rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Composer (right pane)
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<number | null>(null);

  const isDraftDirty = draftTitle.trim().length > 0 || extractText(draftContent).length > 0;

  // Debounced create-or-update for the inline composer
  useEffect(() => {
    if (!isDraftDirty) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        setSavingState("saving");
        const title = draftTitle.trim() || "Untitled";
        const text = extractText(draftContent);
        if (!draftId) {
          const created = await createNote.mutateAsync({ title });
          await updateNote.mutateAsync({
            id: created.id,
            updates: {
              title,
              content: { html: draftContent } as any,
              content_text: text,
            },
          });
          setDraftId(created.id);
        } else {
          await updateNote.mutateAsync({
            id: draftId,
            updates: {
              title,
              content: { html: draftContent } as any,
              content_text: text,
            },
          });
        }
        setSavingState("saved");
      } catch (e: any) {
        setSavingState("idle");
        toast.error(e.message ?? "Could not save");
      }
    }, 700);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTitle, draftContent]);

  const resetComposer = () => {
    setDraftTitle("");
    setDraftContent("");
    setDraftId(null);
    setSavingState("idle");
  };

  const handleOpenDraft = () => {
    if (draftId) navigate(`/app/curriculum/notes/${draftId}`);
  };

  const handleRenameStart = (n: NoteTreeItem) => {
    setRenamingId(n.id);
    setRenameValue(n.title || "");
  };

  const handleRenameSave = async (id: string) => {
    const title = renameValue.trim() || "Untitled";
    try {
      await updateNote.mutateAsync({ id, updates: { title } });
      setRenamingId(null);
    } catch (e: any) {
      toast.error(e.message ?? "Could not rename");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    try {
      await deleteNote.mutateAsync(id);
      if (draftId === id) resetComposer();
    } catch (e: any) {
      toast.error(e.message ?? "Could not delete");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="h-10 w-10 rounded-2xl bubble-glass bubble-tint-yellow flex items-center justify-center">
              <StickyNote className="h-5 w-5 text-amber-600" />
            </span>
            Notes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse on the left. Compose on the right. Auto-saved.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: organized notes list */}
        <section className="bubble-glass bubble-tint-cyan p-5 min-h-[60vh]" data-section="notes.list">
          {notes.length === 0 ? (
            <div className="py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-white/70 mx-auto mb-3 flex items-center justify-center shadow-sm">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                No notes yet — start one on the right.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {buckets.map((b) => (
                <div key={b.key} data-section={`notes.bucket.${b.key}`}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      {b.label}
                    </h2>
                    <span className="text-[10px] text-muted-foreground">
                      {b.notes.length} {b.notes.length === 1 ? "note" : "notes"}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {b.notes.map((n) => (
                      <li
                        key={n.id}
                        className="group flex items-center gap-2 rounded-xl bg-white/60 hover:bg-white/90 border border-white/80 px-3 py-2 transition"
                      >
                        <span className="text-lg shrink-0">{n.icon || "📝"}</span>
                        {renamingId === n.id ? (
                          <>
                            <Input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSave(n.id);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="h-7 text-sm"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleRenameSave(n.id)}
                              title="Save"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setRenamingId(null)}
                              title="Cancel"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => navigate(`/app/curriculum/notes/${n.id}`)}
                              className="flex-1 text-left min-w-0"
                            >
                              <div className="text-sm font-medium truncate text-foreground">
                                {n.title || "Untitled"}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                              </div>
                            </button>
                            <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleRenameStart(n)}
                                title="Rename"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(n.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* RIGHT: composer */}
        <section className="bubble-glass bubble-tint-yellow p-5 min-h-[60vh] flex flex-col" data-section="notes.composer">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              {draftId ? "Editing draft" : "New note"}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {savingState === "saving" && (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                  </span>
                )}
                {savingState === "saved" && "Saved"}
              </span>
              {draftId && (
                <Button size="sm" variant="outline" className="gap-1.5 rounded-full" onClick={handleOpenDraft}>
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 rounded-full"
                onClick={resetComposer}
                disabled={!isDraftDirty && !draftId}
                title="Start a fresh note"
              >
                <Plus className="h-4 w-4" /> New
              </Button>
            </div>
          </div>

          <Input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Untitled"
            className="!text-2xl font-bold border-0 px-0 h-auto py-2 bg-transparent focus-visible:ring-0 shadow-none"
          />

          <div className="flex-1 mt-2">
            <RichTextEditor
              content={draftContent}
              onChange={setDraftContent}
              placeholder="Start writing your note…"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
