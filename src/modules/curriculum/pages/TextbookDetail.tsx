import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@/modules/curriculum/config/router";
import { useAuth } from "@/modules/curriculum/config/auth";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { supabase } from "@/modules/curriculum/config/supabase";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, Copy, ExternalLink, Eye, FileText, FileType2, Loader2, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { bookReaderUrl, bookToResources, groupParts, loadBookChapters, type BookPart, type ResolvedChapter, type Textbook } from "@/modules/curriculum/lib/textbook-book";
import { chapterToLegacyFields, chapterToMarkdown, normalizeChapter } from "@/modules/curriculum/lib/textbook-chapter";
import { AddChaptersDialog, type NewChapter } from "@/modules/curriculum/components/textbook/AddChaptersDialog";
import { PushTextbookDialog } from "@/modules/curriculum/components/textbook/PushTextbookDialog";
import { ChapterViewer } from "@/modules/curriculum/components/textbook/ChapterViewer";

export default function TextbookDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [book, setBook] = useState<Textbook | null>(null);
  const [chapters, setChapters] = useState<ResolvedChapter[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  usePageTitle(book?.title ?? "Textbook");

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from("textbooks").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error("Textbook not found"); navigate("/app/curriculum/textbooks"); return; }
    setBook(data as Textbook);
    try { setChapters(await loadBookChapters(id)); } catch (e: any) { toast.error(e.message); }
  }, [id, navigate]);
  useEffect(() => { if (user) load(); }, [user, load]);

  const parts: BookPart[] = useMemo(() => groupParts(chapters ?? []), [chapters]);
  const flat = useMemo(() => parts.flatMap((p) => p.chapters), [parts]);
  const existing = useMemo(() => new Set((chapters ?? []).map((c) => `${c.source}:${c.source_id}`)), [chapters]);

  async function patchBook(patch: Partial<Textbook>) {
    if (!book) return;
    const { error } = await supabase.from("textbooks").update(patch).eq("id", book.id);
    if (error) { toast.error(error.message); return; }
    setBook({ ...book, ...patch });
  }

  async function addChapters(rows: NewChapter[]) {
    if (!book || !user) return;
    const start = chapters?.length ?? 0;
    const { error } = await supabase.from("textbook_chapters").insert(rows.map((r, i) => ({
      textbook_id: book.id, teacher_id: user.id, part_title: r.part_title, sort_order: start + i, source: r.source,
      lesson_id: r.source === "lesson" ? r.id : null, library_item_id: r.source === "library_item" ? r.id : null,
    })));
    if (error) { toast.error(error.message); return; }
    toast.success(`Added ${rows.length} chapter${rows.length === 1 ? "" : "s"}`);
    setChapters(await loadBookChapters(book.id));
  }

  async function persistOrder(next: ResolvedChapter[]) {
    setChapters(next);
    await Promise.all(next.map((c, i) => supabase.from("textbook_chapters").update({ sort_order: i, part_title: c.part_title }).eq("id", c.id)));
  }
  const move = (i: number, dir: -1 | 1) => { if (!chapters) return; const j = i + dir; if (j < 0 || j >= chapters.length) return; const n = [...chapters]; [n[i], n[j]] = [n[j], n[i]]; persistOrder(n); };
  const setPart = (i: number, title: string) => { if (!chapters) return; const n = chapters.map((c, k) => (k === i ? { ...c, part_title: title || null } : c)); setChapters(n); };
  const commitPart = (i: number) => { if (!chapters) return; supabase.from("textbook_chapters").update({ part_title: chapters[i].part_title }).eq("id", chapters[i].id).then(({ error }) => error && toast.error(error.message)); };
  async function removeChapter(i: number) {
    if (!chapters) return;
    const { error } = await supabase.from("textbook_chapters").delete().eq("id", chapters[i].id);
    if (error) { toast.error(error.message); return; }
    persistOrder(chapters.filter((_, k) => k !== i));
  }

  async function togglePublish(on: boolean) {
    if (!book) return;
    const token = book.share_token ?? crypto.randomUUID();
    await patchBook({ is_published: on, share_token: token });
    if (on) { await navigator.clipboard.writeText(bookReaderUrl(token)).catch(() => {}); toast.success("Published — student link copied"); }
  }

  /** Convert every not-yet-converted chapter with AI, saving back to its source. */
  async function convertAll() {
    if (!chapters || !user) return;
    const targets = chapters.filter((c) => !c.converted);
    if (!targets.length) { toast.info("Every chapter is already in textbook format"); return; }
    setBusy("convert");
    let done = 0;
    const tId = toast.loading(`Converting 0 / ${targets.length}…`);
    try {
      for (const c of targets) {
        const body = c.source === "lesson" ? { title: c.chapter.title, lesson: chapterToLegacyFields(c.chapter) } : { title: c.chapter.title, markdown: chapterToMarkdown(c.chapter) };
        const { data, error } = await supabase.functions.invoke("convert-reading-to-chapter", { body: { ...body, standards: c.standards.map((code) => ({ code, description: "" })) } });
        if (error || data?.error) throw new Error(data?.error || (error as any)?.message);
        const ch = normalizeChapter(data.chapter, c.chapter.title);
        if (c.source === "lesson") await supabase.from("curriculum_lessons").update({ ...chapterToLegacyFields(ch), chapter: ch } as any).eq("id", c.source_id);
        else await supabase.from("library_items").update({ chapter: ch as any, body: chapterToMarkdown(ch) }).eq("id", c.source_id);
        done++;
        toast.loading(`Converting ${done} / ${targets.length}…`, { id: tId });
      }
      toast.success(`Converted ${done} chapter${done === 1 ? "" : "s"}`, { id: tId });
    } catch (e: any) {
      toast.error(`${e?.message ?? "Conversion failed"} (${done} done)`, { id: tId });
    } finally {
      setBusy(null);
      if (book) setChapters(await loadBookChapters(book.id));
    }
  }

  async function exportBook(fmt: "docx" | "pdf") {
    if (!book) return;
    setBusy(fmt);
    try {
      const res = bookToResources(book, parts, { includeAnswers: true });
      if (fmt === "docx") { const { exportResourcesDocx } = await import("@/lib/export/docx"); await exportResourcesDocx(res); }
      else { const { exportResourcesPdf } = await import("@/lib/export/pdf"); await exportResourcesPdf(res); }
      toast.success("Download started");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); } finally { setBusy(null); }
  }

  if (!book) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const unconverted = (chapters ?? []).filter((c) => !c.converted).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-background/90 backdrop-blur flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[{ label: "Textbooks", path: "/app/curriculum/textbooks" }, { label: book.title }]} />
      </header>
      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Input value={book.title} onChange={(e) => setBook({ ...book, title: e.target.value })} onBlur={() => patchBook({ title: book.title })} className="font-display text-3xl h-auto border-transparent hover:border-input px-1" />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Input value={book.subject ?? ""} placeholder="Subject" onChange={(e) => setBook({ ...book, subject: e.target.value })} onBlur={() => patchBook({ subject: book.subject || null })} className="h-7 w-32 text-xs" />
              <Input value={book.grade ?? ""} placeholder="Grade" onChange={(e) => setBook({ ...book, grade: e.target.value })} onBlur={() => patchBook({ grade: book.grade || null })} className="h-7 w-20 text-xs" />
              <Badge variant="outline" className="font-normal">{flat.length} chapters · {parts.length} parts</Badge>
              {unconverted > 0 && <Badge variant="outline" className="font-normal border-accent text-accent-foreground">{unconverted} not yet in chapter format</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add chapters</Button>
            {unconverted > 0 && <Button variant="outline" size="sm" className="gap-1.5 border-primary/40 text-primary" disabled={!!busy} onClick={convertAll}>{busy === "convert" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Convert {unconverted} to chapters</Button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={!flat.length || !!busy}>{busy === "docx" || busy === "pdf" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}Export <ChevronDown className="h-4 w-4 ml-1" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportBook("docx")}><FileText className="h-4 w-4 mr-2" /> Word (.docx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportBook("pdf")}><FileType2 className="h-4 w-4 mr-2" /> PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="gap-1.5" disabled={!flat.length} onClick={() => setPushOpen(true)}><Send className="h-4 w-4" /> Send to Canvas / Google</Button>
          </div>
        </div>

        {/* Publish */}
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <Switch id="pub" checked={book.is_published} onCheckedChange={togglePublish} />
            <div>
              <Label htmlFor="pub" className="font-semibold">Student link</Label>
              <p className="text-xs text-muted-foreground">{book.is_published ? "Anyone with the link can read this book." : "Turn on to get a read-only link for students."}</p>
            </div>
          </div>
          {book.is_published && book.share_token && (
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted rounded px-2 py-1 truncate max-w-[260px]">{bookReaderUrl(book.share_token)}</code>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(bookReaderUrl(book.share_token!)); toast.success("Link copied"); }}><Copy className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" asChild><a href={bookReaderUrl(book.share_token)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
            </div>
          )}
        </div>

        {/* Chapters */}
        {chapters === null ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading chapters…</div>
          : chapters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-semibold">No chapters yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add readings from a subject's units or pick them one by one.</p>
              <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add chapters</Button>
            </div>
          ) : (
            <ol className="space-y-2">
              {chapters.map((c, i) => {
                const num = i + 1;
                const showPart = i === 0 || (chapters[i - 1].part_title ?? "") !== (c.part_title ?? "");
                return (
                  <li key={c.id} className="space-y-2">
                    {showPart && (
                      <div className="flex items-center gap-2 pt-3">
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Part</span>
                        <Input value={c.part_title ?? ""} placeholder="Part title (optional)" onChange={(e) => setPart(i, e.target.value)} onBlur={() => commitPart(i)} className="h-8 max-w-sm font-semibold" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                      <span className="w-8 text-center font-semibold text-primary tabular-nums">{num}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.chapter.title}</p>
                        <p className="text-xs text-muted-foreground flex flex-wrap gap-1.5 items-center">
                          {c.source === "lesson" ? "Curriculum reading" : "Library reading"}
                          {c.converted ? <Badge variant="outline" className="text-[10px] font-normal border-primary/40 text-primary">Chapter format</Badge> : <Badge variant="outline" className="text-[10px] font-normal">Basic layout</Badge>}
                          {c.standards.slice(0, 3).map((s) => <Badge key={s} variant="secondary" className="text-[10px] font-normal">{s}</Badge>)}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview" onClick={() => setPreview(i)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === chapters.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeChapter(i)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
      </main>

      <AddChaptersDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={addChapters} existing={existing} />
      <PushTextbookDialog open={pushOpen} onClose={() => setPushOpen(false)} book={book} parts={parts} />
      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="sr-only">Chapter preview</DialogTitle></DialogHeader>
          {preview !== null && flat[preview] && (
            <ChapterViewer
              chapter={flat[preview].chapter} teacherMode standards={flat[preview].standards.map((code) => ({ code, description: "" }))}
              prev={preview > 0 ? { title: flat[preview - 1].chapter.title, onClick: () => setPreview(preview - 1) } : null}
              next={preview < flat.length - 1 ? { title: flat[preview + 1].chapter.title, onClick: () => setPreview(preview + 1) } : null}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
