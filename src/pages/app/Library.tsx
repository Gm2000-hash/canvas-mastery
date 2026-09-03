// Library — the repository for everything imported into or created by the app:
// Canvas quiz questions, plus readings, activities, and lesson plans that are
// uploaded, written in-app, AI-generated, or imported from Canvas pages/files.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Download, HelpCircle, Loader2, Pencil, Plus, Search, Sparkles, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import QuestionsTab, { QuestionDrawer, type QuestionRow } from "./standards/QuestionsTab";
import { SECTIONS, type LibraryItem, type LibraryKind, type LibrarySection } from "@/components/library/libraryTypes";
import { StandardsPicker, useStandardOptions } from "@/components/library/StandardsPicker";
import { LibraryItemCard } from "@/components/library/LibraryItemCard";
import { LibraryItemEditor, draftFromItem, type EditorDraft } from "@/components/library/LibraryItemEditor";
import { GenerateContentDialog } from "@/components/library/GenerateContentDialog";

type SearchRow = {
  item_type: LibrarySection;
  item_id: string;
  title: string;
  snippet: string | null;
  source: string;
  standards: { id: string; code: string; description: string }[];
  updated_at: string;
  rank: number;
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function Library() {
  const { profile } = useProfile();
  const [params, setParams] = useSearchParams();
  const section = (params.get("section") as LibrarySection | null) ?? null;
  const setSection = (s: LibrarySection | null) => setParams((p) => { if (s) p.set("section", s); else p.delete("section"); return p; });

  // ---- Search state ----
  const [q, setQ] = useState(params.get("q") ?? "");
  const dq = useDebounced(q, 300);
  const [stdFilter, setStdFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [results, setResults] = useState<SearchRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const { standards: allStandards } = useStandardOptions();
  const stdById = useMemo(() => new Map(allStandards.map((s) => [s.id, s])), [allStandards]);
  const isSearching = dq.trim().length > 0 || stdFilter.length > 0;

  useEffect(() => {
    if (!isSearching) { setResults(null); return; }
    let alive = true;
    setSearching(true);
    supabase.rpc("search_library", { _q: dq.trim() || null, _standard_id: stdFilter[0] ?? null, _kind: typeFilter })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) toast.error(error.message);
        setResults((data as any as SearchRow[]) ?? []);
        setSearching(false);
      });
    return () => { alive = false; };
  }, [dq, stdFilter, typeFilter, isSearching]);

  // ---- Counts + items ----
  const [counts, setCounts] = useState<Record<LibrarySection, number | null>>({ question: null, reading: null, activity: null, lesson_plan: null });
  const [items, setItems] = useState<LibraryItem[] | null>(null);

  const loadCounts = useCallback(async () => {
    const [qc, li] = await Promise.all([
      supabase.from("quiz_questions").select("id", { count: "exact", head: true }),
      supabase.from("library_items").select("kind"),
    ]);
    const c: Record<LibrarySection, number | null> = { question: qc.count ?? 0, reading: 0, activity: 0, lesson_plan: 0 };
    (li.data ?? []).forEach((r: any) => { c[r.kind as LibraryKind] = (c[r.kind as LibraryKind] ?? 0) + 1; });
    setCounts(c);
  }, []);

  const loadItems = useCallback(async (kind: LibraryKind) => {
    setItems(null);
    const { data, error } = await supabase.from("library_items")
      .select("id, kind, title, body, source, file_path, file_mime, file_name, grade, subject, canvas_course_id, created_at, updated_at, library_item_standards(standard_id, standards(id, code, description))")
      .eq("kind", kind).order("updated_at", { ascending: false });
    if (error) { toast.error(error.message); setItems([]); return; }
    setItems((data as any[]).map((r) => ({
      ...r,
      standards: (r.library_item_standards ?? []).map((l: any) => l.standards).filter(Boolean),
    })));
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { if (section && section !== "question") loadItems(section); }, [section, loadItems]);
  const refresh = () => { loadCounts(); if (section && section !== "question") loadItems(section); };

  // ---- Dialogs ----
  const [editor, setEditor] = useState<{ draft: EditorDraft; mode: "create" | "upload" | "edit" } | null>(null);
  const [genKind, setGenKind] = useState<LibraryKind | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<QuestionRow | null>(null);

  const blankDraft = (kind: LibraryKind, source: EditorDraft["source"]): EditorDraft => ({
    kind, title: "", body: "", source, grade: profile?.default_grade ?? null, subject: profile?.default_subject ?? null, standardIds: [],
  });

  async function openQuestionResult(id: string) {
    const { data, error } = await supabase.from("quiz_questions")
      .select("id, position, question_text, points_possible, assignment_id, answers, item_type, assignments(id, name, course_id)")
      .eq("id", id).maybeSingle();
    if (error || !data) { toast.error("Could not open question"); return; }
    setOpenQuestion(data as any as QuestionRow);
  }

  async function openItemResult(id: string) {
    const { data } = await supabase.from("library_items")
      .select("id, kind, title, body, source, file_path, file_mime, file_name, grade, subject, canvas_course_id, created_at, updated_at, library_item_standards(standards(id, code, description))")
      .eq("id", id).maybeSingle();
    if (!data) return;
    const it: LibraryItem = { ...(data as any), standards: ((data as any).library_item_standards ?? []).map((l: any) => l.standards).filter(Boolean) };
    setEditor({ draft: draftFromItem(it), mode: "edit" });
  }

  const currentMeta = section ? SECTIONS.find((s) => s.key === section)! : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2">Library</h1>
        <p className="text-muted-foreground">Everything imported into or created by the app — searchable by content and standard.</p>
      </div>

      {/* Search */}
      <Card className="border-primary/20 bg-card/60">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_260px_170px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions, readings, activities, lesson plans…" className="pl-9 h-11 rounded-full" />
              {q && <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X className="h-4 w-4" /></button>}
            </div>
            <StandardsPicker value={stdFilter} onChange={(ids) => setStdFilter(ids.slice(-1))} multiple={false} placeholder="Any standard" subjectHint={profile?.default_subject} />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                {SECTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {stdFilter[0] && stdById.get(stdFilter[0]) && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1 pr-1">
                {stdById.get(stdFilter[0])!.code}
                <button onClick={() => setStdFilter([])} className="rounded-full hover:bg-muted p-0.5" aria-label="Clear standard filter"><X className="h-3 w-3" /></button>
              </Badge>
              <span className="text-muted-foreground line-clamp-1">{stdById.get(stdFilter[0])!.description}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {isSearching ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">{searching ? "Searching…" : `${results?.length ?? 0} result${results?.length === 1 ? "" : "s"}`}</h2>
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStdFilter([]); }}>Clear search</Button>
          </div>
          {searching && !results ? <div className="grid gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> : null}
          {results && results.length === 0 && <p className="text-muted-foreground text-sm">Nothing matched. Try fewer words or a different standard.</p>}
          <div className="grid gap-2">
            {results?.map((r) => {
              const meta = SECTIONS.find((s) => s.key === r.item_type)!;
              return (
                <button key={`${r.item_type}-${r.item_id}`} onClick={() => r.item_type === "question" ? openQuestionResult(r.item_id) : openItemResult(r.item_id)}
                  className="text-left rounded-lg border bg-card hover:bg-accent/40 transition-colors p-3 flex gap-3 items-start">
                  <img src={meta.image} alt="" width={64} height={43} loading="lazy" className="w-16 h-11 rounded object-cover shrink-0 hidden sm:block" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[11px] font-normal">{meta.label}</Badge>
                      <span className="font-sans font-semibold text-sm truncate">{r.title}</span>
                    </div>
                    {r.snippet && <p className="text-sm text-muted-foreground line-clamp-2 font-sans mt-0.5">{r.snippet}</p>}
                    {r.standards?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">{r.standards.slice(0, 5).map((s) => <Badge key={s.id} variant="secondary" className="text-[11px] font-normal" title={s.description}>{s.code}</Badge>)}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          {/* Tiles */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {SECTIONS.map((s) => {
              const active = section === s.key;
              return (
                <button key={s.key} onClick={() => setSection(active ? null : s.key)}
                  className={cn("group text-left rounded-2xl overflow-hidden border bg-card transition-all hover:shadow-lg hover:-translate-y-0.5",
                    active ? "ring-2 ring-primary shadow-lg" : "hover:border-primary/40")}>
                  <div className="aspect-[3/2] overflow-hidden bg-muted">
                    <img src={s.image} alt={s.label} width={768} height={512} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="font-display text-xl">{s.label}</h2>
                      <span className="font-sans text-sm text-muted-foreground tabular-nums">{counts[s.key] == null ? "…" : `${counts[s.key]} item${counts[s.key] === 1 ? "" : "s"}`}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 font-sans">{s.blurb}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected section */}
          {!section && (
            <p className="text-sm text-muted-foreground text-center py-6">Choose a tile to browse that collection, or search above.</p>
          )}

          {section === "question" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-display text-2xl">Question bank</h2>
                <Button variant="ghost" size="sm" onClick={() => setSection(null)}>Close</Button>
              </div>
              <QuestionsTab />
            </section>
          )}

          {section && section !== "question" && currentMeta && (
            <section className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-display text-2xl">{currentMeta.label}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setEditor({ draft: blankDraft(section, "upload"), mode: "upload" })}><Upload className="h-4 w-4 mr-1.5" /> Upload</Button>
                  <Button variant="outline" size="sm" onClick={() => setEditor({ draft: blankDraft(section, "created"), mode: "create" })}><Plus className="h-4 w-4 mr-1.5" /> Create</Button>
                  <Button size="sm" onClick={() => setGenKind(section)}><Sparkles className="h-4 w-4 mr-1.5" /> Generate with AI</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">More <ChevronDown className="h-4 w-4 ml-1" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setImportOpen(true)}><Download className="h-4 w-4 mr-2" /> Import from Canvas…</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSection(null)}><X className="h-4 w-4 mr-2" /> Close section</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {items === null ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
              ) : items.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center space-y-3">
                    <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground/60" />
                    <p className="font-sans text-muted-foreground">No {currentMeta.label.toLowerCase()} yet. Upload a file, write one, generate a draft with AI, or import Canvas pages and files.</p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Download className="h-4 w-4 mr-1.5" /> Import from Canvas</Button>
                      <Button size="sm" onClick={() => setGenKind(section)}><Sparkles className="h-4 w-4 mr-1.5" /> Generate with AI</Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((it) => <LibraryItemCard key={it.id} item={it} onEdit={(x) => setEditor({ draft: draftFromItem(x), mode: "edit" })} onChanged={refresh} />)}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <LibraryItemEditor
        open={!!editor}
        draft={editor?.draft ?? null}
        mode={editor?.mode ?? "create"}
        onClose={() => setEditor(null)}
        onSaved={refresh}
        subjectHint={profile?.default_subject}
      />
      {genKind && (
        <GenerateContentDialog
          open={!!genKind}
          kind={genKind}
          onClose={() => setGenKind(null)}
          onDraft={(d) => setEditor({ draft: d, mode: "create" })}
          subjectHint={profile?.default_subject}
          gradeHint={profile?.default_grade}
        />
      )}
      <CanvasImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={refresh} />
      <QuestionDrawer question={openQuestion} onClose={() => setOpenQuestion(null)} />
    </div>
  );
}

function CanvasImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("courses").select("id, name").eq("hidden", false).is("archived_at", null).order("name")
      .then(({ data }) => setCourses((data as any) ?? []));
  }, [open]);

  async function run() {
    if (!picked.size) { toast.error("Pick at least one class"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("canvas-import-materials", { body: { course_ids: Array.from(picked) } });
      if (error) throw new Error((error as any).message ?? "Import failed");
      if ((data as any)?.error) throw new Error(String((data as any).error));
      const s = (data as any).stats;
      toast.success(`Imported ${s.pages} page${s.pages === 1 ? "" : "s"} and ${s.files} file${s.files === 1 ? "" : "s"}${s.skipped ? ` (${s.skipped} skipped)` : ""}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Import from Canvas</DialogTitle>
          <DialogDescription>Pulls published course pages and files (PDF, Office, images up to 20 MB) into Readings. You can move them to Activities or Lesson plans afterward.</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {courses.length === 0 && <p className="text-sm text-muted-foreground">No synced classes yet.</p>}
          {courses.map((c) => (
            <label key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 cursor-pointer text-sm font-sans">
              <Checkbox checked={picked.has(c.id)} onCheckedChange={(v) => setPicked((p) => { const n = new Set(p); v ? n.add(c.id) : n.delete(c.id); return n; })} />
              {c.name}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}{busy ? "Importing…" : "Import"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
