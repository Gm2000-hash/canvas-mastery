import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { StandardsPicker } from "./StandardsPicker";
import { DOK_LEVELS, SECTIONS, type LibraryItem, type LibraryKind, type LibrarySource } from "./libraryTypes";
import { GRADES } from "@/lib/frameworks";
import { cn } from "@/lib/utils";
import { ChapterEditor } from "@/modules/curriculum/components/textbook/ChapterEditor";
import { useConvertToChapter } from "@/modules/curriculum/components/textbook/useConvertToChapter";
import { chapterDokLevels, chapterToMarkdown, isChapter, normalizeChapter, type TextbookChapter } from "@/modules/curriculum/lib/textbook-chapter";
import { Sparkles } from "lucide-react";

export type EditorDraft = {
  id?: string;
  kind: LibraryKind;
  title: string;
  body: string;
  source: LibrarySource;
  grade: string | null;
  subject: string | null;
  standardIds: string[];
  dokLevels: number[];
  file_path?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  /** Structured textbook chapter (readings). When set, `body` is derived from it on save. */
  chapter?: TextbookChapter | null;
};

export function draftFromItem(it: LibraryItem): EditorDraft {
  return {
    id: it.id, kind: it.kind, title: it.title, body: it.body ?? "", source: it.source,
    grade: it.grade, subject: it.subject, standardIds: it.standards.map((s) => s.id),
    dokLevels: it.dok_levels ?? [],
    file_path: it.file_path, file_name: it.file_name, file_mime: it.file_mime,
    chapter: isChapter(it.chapter) ? normalizeChapter(it.chapter, it.title) : null,
  };
}

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,image/*";

export function LibraryItemEditor({ draft, open, onClose, onSaved, subjectHint, mode = "create" }: {
  draft: EditorDraft | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  subjectHint?: string | null;
  mode?: "create" | "upload" | "edit";
}) {
  const [d, setD] = useState<EditorDraft | null>(draft);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { convert, converting } = useConvertToChapter();
  const [standardMeta, setStandardMeta] = useState<{ code: string; description: string }[]>([]);

  useEffect(() => { setD(draft); setFile(null); }, [draft, open]);
  if (!d) return null;

  const set = (patch: Partial<EditorDraft>) => setD((p) => (p ? { ...p, ...patch } : p));
  const useChapter = d.kind === "reading" && isChapter(d.chapter);

  async function loadStandardMeta() {
    if (!d?.standardIds.length) return [];
    const { data } = await supabase.from("standards").select("code, description").in("id", d.standardIds);
    const meta = (data ?? []).map((s) => ({ code: s.code, description: s.description }));
    setStandardMeta(meta);
    return meta;
  }

  async function convertToChapter() {
    if (!d) return;
    const standards = await loadStandardMeta();
    const ch = await convert({ title: d.title || "Reading", markdown: d.body, standards });
    if (ch) set({ chapter: ch, title: ch.title || d.title, dokLevels: chapterDokLevels(ch).length ? chapterDokLevels(ch) : d.dokLevels });
  }

  async function save() {
    if (!d) return;
    if (!d.title.trim()) { toast.error("Give it a title"); return; }
    if (mode === "upload" && !file && !d.file_path) { toast.error("Choose a file to upload"); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not signed in");

      let file_path = d.file_path ?? null, file_name = d.file_name ?? null, file_mime = d.file_mime ?? null;
      if (file) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
        const path = `${uid}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("library-files").upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        file_path = path; file_name = file.name; file_mime = file.type || null;
      }

      const chapter = d.kind === "reading" && isChapter(d.chapter) ? { ...d.chapter, title: d.title.trim() || d.chapter.title } : null;
      const body = chapter ? chapterToMarkdown(chapter) : d.body.trim() || null;
      const row = {
        teacher_id: uid, kind: d.kind, title: d.title.trim(), body,
        source: d.source, grade: d.grade, subject: d.subject, file_path, file_name, file_mime,
        dok_levels: Array.from(new Set(d.dokLevels)).sort(),
        chapter: chapter as any,
      };
      let id = d.id;
      if (id) {
        const { error } = await supabase.from("library_items").update(row).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("library_items").insert(row).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      // Replace standard links.
      await supabase.from("library_item_standards").delete().eq("library_item_id", id!);
      if (d.standardIds.length) {
        const { error } = await supabase.from("library_item_standards")
          .insert(d.standardIds.map((sid) => ({ teacher_id: uid, library_item_id: id!, standard_id: sid })));
        if (error) throw error;
      }
      toast.success(d.id ? "Saved" : "Added to your library");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const kindLabel = SECTIONS.find((s) => s.key === d.kind)?.singular ?? "item";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {mode === "edit" ? `Edit ${kindLabel}` : mode === "upload" ? `Upload a ${kindLabel}` : `New ${kindLabel}`}
          </DialogTitle>
          <DialogDescription>
            {d.source === "ai" ? "Review the AI draft, adjust anything you like, then save it to your library." : "Tag standards so this shows up in searches and reports."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid sm:grid-cols-[1fr_140px_140px] gap-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Plate tectonics reading" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={d.kind} onValueChange={(v) => set({ kind: v as LibraryKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTIONS.filter((s) => s.key !== "question").map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select value={d.grade ?? "none"} onValueChange={(v) => set({ grade: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any</SelectItem>
                  {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Standards</Label>
            <StandardsPicker value={d.standardIds} onChange={(ids) => set({ standardIds: ids })} subjectHint={subjectHint} />
          </div>

          <div className="space-y-1.5">
            <Label>Depth of Knowledge</Label>
            <div className="flex flex-wrap gap-2">
              {DOK_LEVELS.map((lvl) => {
                const on = d.dokLevels.includes(lvl.level);
                return (
                  <button key={lvl.level} type="button" title={lvl.blurb} aria-pressed={on}
                    onClick={() => set({ dokLevels: on ? d.dokLevels.filter((x) => x !== lvl.level) : [...d.dokLevels, lvl.level] })}
                    className={cn("rounded-full border px-3 py-1 text-xs font-sans transition-colors",
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent/50 text-muted-foreground")}>
                    DOK {lvl.level} · {lvl.name}
                  </button>
                );
              })}
              {!d.dokLevels.length && <span className="text-xs text-muted-foreground self-center">None yet — the AI tagger will fill this in, or pick levels by hand.</span>}
            </div>
          </div>

          {(mode === "upload" || d.file_path || file) && (
            <div className="space-y-1.5">
              <Label>File</Label>
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1.5" /> {file || d.file_path ? "Replace file" : "Choose file"}
                </Button>
                {(file || d.file_name) && (
                  <Badge variant="secondary" className="gap-1.5 font-normal">
                    <FileText className="h-3.5 w-3.5" /> {file?.name ?? d.file_name}
                    {file && <button type="button" onClick={() => setFile(null)} aria-label="Remove file"><X className="h-3 w-3" /></button>}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">PDF, Word, PowerPoint, text, or images · up to 50 MB</span>
              </div>
            </div>
          )}

          {useChapter ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">Textbook chapter <Badge variant="outline" className="text-[10px] font-normal border-primary/40 text-primary">Chapter format</Badge></Label>
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => set({ chapter: null, body: d.body || chapterToMarkdown(d.chapter!) })}>Switch to plain Markdown</Button>
              </div>
              <div className="rounded-xl border border-border p-4 max-h-[60vh] overflow-y-auto">
                <ChapterEditor chapter={d.chapter!} onChange={(c) => set({ chapter: c, title: c.title || d.title })} standards={standardMeta} />
              </div>
            </div>
          ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{mode === "upload" ? "Notes (optional)" : "Content"}</Label>
              {d.kind === "reading" && mode !== "upload" && d.body.trim() && (
                <Button type="button" variant="outline" size="sm" className="text-xs gap-1 border-primary/40 text-primary" disabled={converting} onClick={convertToChapter}>
                  {converting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Convert to textbook chapter
                </Button>
              )}
            </div>
            <Tabs defaultValue="write">
              <TabsList className="h-8">
                <TabsTrigger value="write" className="text-xs">Write</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="write">
                <Textarea
                  value={d.body}
                  onChange={(e) => set({ body: e.target.value })}
                  rows={mode === "upload" ? 4 : 16}
                  className="font-sans text-sm leading-relaxed"
                  placeholder={"Write in Markdown — # Heading, **bold**, - lists, 1. steps…"}
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="prose prose-sm max-w-none rounded-md border p-4 min-h-[120px] font-sans">
                  {d.body.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{d.body}</ReactMarkdown> : <p className="text-muted-foreground">Nothing to preview yet.</p>}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {d.id ? "Save changes" : "Save to library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
