// Public, read-only digital textbook at /book/:token.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "@/modules/curriculum/config/router";
import { supabase } from "@/modules/curriculum/config/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, BookOpen, ChevronLeft, ChevronRight, List, Loader2, Printer, X } from "lucide-react";
import { ChapterViewer } from "@/modules/curriculum/components/textbook/ChapterViewer";
import { groupParts, HOW_TO_USE, resolveChapter, type BookPart } from "@/modules/curriculum/lib/textbook-book";
import { mergeGlossary } from "@/modules/curriculum/lib/textbook-chapter";
import { cn } from "@/lib/utils";

interface SharedBook { id: string; title: string; subject: string | null; grade: string | null; cover_url: string | null; description: string | null; chapters: any[] }

export default function TextbookReader() {
  const { token } = useParams<{ token: string }>();
  const [book, setBook] = useState<SharedBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"front" | "glossary" | number>("front");
  const [navOpen, setNavOpen] = useState(false);
  const bookmarkKey = `textbook-bookmark:${token}`;

  useEffect(() => {
    if (!token) { setError("Invalid link"); return; }
    supabase.rpc("get_shared_textbook", { _share_token: token }).then(({ data, error }) => {
      if (error || !data) { setError("This textbook is not available or the link has expired."); return; }
      setBook(data as unknown as SharedBook);
      const saved = Number(localStorage.getItem(bookmarkKey));
      if (Number.isFinite(saved) && saved >= 0 && localStorage.getItem(bookmarkKey) !== null) setView(saved);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (typeof view === "number") localStorage.setItem(bookmarkKey, String(view));
    window.scrollTo({ top: 0 });
  }, [view, bookmarkKey]);

  useEffect(() => { if (book) document.title = `${book.title} · Textbook`; }, [book]);

  const parts: BookPart[] = useMemo(() => book ? groupParts(book.chapters.map((c: any) => resolveChapter({
    id: c.id, part_title: c.part_title, source: c.source, source_id: c.id, title: c.title ?? "Chapter", chapter: c.chapter, legacy: c.legacy ?? undefined, body: c.body,
  }))) : [], [book]);
  const flat = useMemo(() => parts.flatMap((p) => p.chapters), [parts]);
  const glossary = useMemo(() => mergeGlossary(flat.map((c) => c.chapter)), [flat]);

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3 max-w-md px-4"><AlertCircle className="h-12 w-12 text-muted-foreground/40 mx-auto" /><h1 className="text-xl font-semibold">Textbook not found</h1><p className="text-sm text-muted-foreground">{error}</p></div>
    </div>
  );
  if (!book) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const current = typeof view === "number" ? flat[view] : null;
  const Nav = () => (
    <nav className="text-sm space-y-4" aria-label="Book contents">
      <button onClick={() => { setView("front"); setNavOpen(false); }} className={cn("block w-full text-left rounded-md px-2 py-1.5 hover:bg-accent/40", view === "front" && "bg-primary/10 text-primary font-medium")}>How to use this book</button>
      {parts.map((p, pi) => (
        <div key={pi}>
          {p.title && <p className="px-2 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{p.title}</p>}
          <ul className="space-y-0.5">
            {p.chapters.map((c) => { const idx = flat.indexOf(c); return (
              <li key={c.id}><button onClick={() => { setView(idx); setNavOpen(false); }} className={cn("flex w-full text-left gap-2 rounded-md px-2 py-1.5 hover:bg-accent/40 leading-snug", view === idx && "bg-primary/10 text-primary font-medium")}><span className="tabular-nums text-muted-foreground w-5 shrink-0">{c.chapter.number}</span><span>{c.chapter.title}</span></button></li>
            ); })}
          </ul>
        </div>
      ))}
      {glossary.length > 0 && <button onClick={() => { setView("glossary"); setNavOpen(false); }} className={cn("block w-full text-left rounded-md px-2 py-1.5 hover:bg-accent/40", view === "glossary" && "bg-primary/10 text-primary font-medium")}>Glossary</button>}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 h-14 border-b border-border/60 bg-background/90 backdrop-blur flex items-center px-4 gap-3 print:hidden">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Contents"><List className="h-5 w-5" /></Button>
        <BookOpen className="h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate">{book.title}</h1>
          <p className="text-[11px] text-muted-foreground truncate">{[book.subject, book.grade ? `Grade ${book.grade}` : null].filter(Boolean).join(" · ") || "Digital textbook"}{current ? ` · Chapter ${current.chapter.number} of ${flat.length}` : ""}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => window.print()} title="Print this page" aria-label="Print"><Printer className="h-4 w-4" /></Button>
      </header>

      <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-border p-4 print:hidden"><Nav /></aside>
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-foreground/30" onClick={() => setNavOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-background border-r border-border p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-3"><p className="font-semibold">Contents</p><Button variant="ghost" size="icon" onClick={() => setNavOpen(false)} aria-label="Close"><X className="h-4 w-4" /></Button></div>
              <Nav />
            </div>
          </div>
        )}

        <main className="px-5 sm:px-8 py-8 lg:py-10">
          {view === "front" && (
            <article className="max-w-3xl font-sans">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Welcome</p>
              <h2 className="font-display text-4xl leading-tight">{book.title}</h2>
              {book.description && <p className="mt-4 text-lg text-muted-foreground">{book.description}</p>}
              <section className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6">
                <h3 className="font-semibold text-primary mb-3">How to use this book</h3>
                <ol className="space-y-3">{HOW_TO_USE.map((h, i) => <li key={i} className="flex gap-3 text-sm leading-relaxed"><span className="font-semibold text-primary tabular-nums">{i + 1}.</span><span><strong>{h.title}.</strong> {h.tip}</span></li>)}</ol>
              </section>
              <section className="mt-8">
                <h3 className="font-display text-2xl mb-3">Contents</h3>
                {parts.map((p, pi) => (
                  <div key={pi} className="mb-4">
                    {p.title && <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{p.title}</p>}
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {p.chapters.map((c) => { const idx = flat.indexOf(c); return (
                        <li key={c.id}><button onClick={() => setView(idx)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/30"><span className="font-semibold text-primary tabular-nums w-6">{c.chapter.number}</span><span className="flex-1">{c.chapter.title}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button></li>
                      ); })}
                    </ul>
                  </div>
                ))}
                {flat.length === 0 && <p className="text-sm text-muted-foreground">This book has no chapters yet.</p>}
              </section>
              {flat.length > 0 && <Button className="mt-4 gap-2" onClick={() => setView(0)}>Start reading <ChevronRight className="h-4 w-4" /></Button>}
            </article>
          )}
          {view === "glossary" && (
            <article className="max-w-3xl font-sans">
              <h2 className="font-display text-4xl mb-6">Glossary</h2>
              <dl className="divide-y divide-border">
                {glossary.map((g) => <div key={g.term} className="py-3"><dt className="font-semibold flex items-center gap-2">{g.term} <Badge variant="outline" className="text-[10px] font-normal">{g.chapter}</Badge></dt><dd className="text-sm text-muted-foreground mt-0.5">{g.definition}</dd></div>)}
              </dl>
            </article>
          )}
          {current && (
            <ChapterViewer
              key={current.id}
              chapter={current.chapter}
              standards={current.standards.map((code) => ({ code, description: "" }))}
              prev={typeof view === "number" && view > 0 ? { title: flat[view - 1].chapter.title, onClick: () => setView(view - 1) } : { title: "How to use this book", onClick: () => setView("front") }}
              next={typeof view === "number" && view < flat.length - 1 ? { title: flat[view + 1].chapter.title, onClick: () => setView(view + 1) } : glossary.length ? { title: "Glossary", onClick: () => setView("glossary") } : null}
            />
          )}
          {current && (
            <div className="mt-8 flex justify-between text-xs text-muted-foreground print:hidden">
              <button onClick={() => setView("front")} className="inline-flex items-center gap-1 hover:text-foreground"><ChevronLeft className="h-3 w-3" /> Contents</button>
              <span>Your place is saved in this browser.</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
