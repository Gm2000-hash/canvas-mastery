import { useMemo, useState, type MouseEvent } from "react";
import { sanitizeRichHtml } from "@/modules/curriculum/lib/sanitize-rich-html";
import { CALLOUT_LABEL, SECTION_ROLE_LABEL, inlineToHtml, type CalloutKind, type TextbookChapter } from "@/modules/curriculum/lib/textbook-chapter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft, ChevronRight, Eye, EyeOff, HelpCircle, Lightbulb, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  chapter: TextbookChapter;
  /** Teachers see model answers; students get a reveal toggle per question. */
  teacherMode?: boolean;
  showToc?: boolean;
  standards?: { code: string; description: string }[];
  prev?: { title: string; onClick: () => void } | null;
  next?: { title: string; onClick: () => void } | null;
  className?: string;
}

const CALLOUT_STYLE: Record<CalloutKind, { icon: typeof Lightbulb; cls: string }> = {
  stop_and_think: { icon: HelpCircle, cls: "border-primary/40 bg-primary/5" },
  did_you_know: { icon: Lightbulb, cls: "border-accent/60 bg-accent/10" },
  connect_it: { icon: Link2, cls: "border-secondary-foreground/30 bg-secondary/40" },
};

/** Turn **term** / <strong>term</strong> into clickable glossary markers. */
function markTerms(html: string, terms: Set<string>): string {
  return html.replace(/<strong>(.*?)<\/strong>/gi, (m, t: string) => {
    const key = t.replace(/<[^>]+>/g, "").trim().toLowerCase();
    return terms.has(key) ? `<strong class="glossary-term cursor-pointer underline decoration-dotted decoration-primary/60 underline-offset-4" data-term="${key}">${t}</strong>` : m;
  });
}

export function ChapterViewer({ chapter: ch, teacherMode, showToc = true, standards, prev, next, className }: Props) {
  const [activeTerm, setActiveTerm] = useState<{ term: string; definition: string } | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [allAnswers, setAllAnswers] = useState(!!teacherMode);
  const glossary = useMemo(() => new Map(ch.glossary.map((g) => [g.term.trim().toLowerCase(), g])), [ch.glossary]);
  const termKeys = useMemo(() => new Set(glossary.keys()), [glossary]);
  const rich = (t: string) => ({ __html: markTerms(sanitizeRichHtml(inlineToHtml(t)), termKeys) });

  const onBodyClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-term]");
    if (!el) return;
    const g = glossary.get(el.dataset.term ?? "");
    if (g) setActiveTerm(g);
  };

  const tocItems = [
    ...(ch.before_you_read.preview || ch.before_you_read.guiding_questions.length ? [{ id: "before", label: "Before You Read" }] : []),
    ...ch.sections.map((s, i) => ({ id: `sec-${i}`, label: `${s.number ? s.number + " " : ""}${s.heading}` })),
    ...(ch.real_world.paragraphs.length ? [{ id: "real-world", label: "In the Real World" }] : []),
    ...(ch.summary.length ? [{ id: "summary", label: "Chapter Summary" }] : []),
    ...(ch.review_questions.length ? [{ id: "review", label: "Comprehension Questions" }] : []),
    ...(ch.glossary.length ? [{ id: "glossary", label: "Key Terms" }] : []),
  ];

  return (
    <div className={cn("relative lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10", className)}>
      {showToc && (
        <nav className="hidden lg:block sticky top-4 self-start text-sm" aria-label="In this chapter">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">In this chapter</p>
          <ul className="space-y-1.5 border-l border-border">
            {tocItems.map((t) => (
              <li key={t.id}><a href={`#${t.id}`} className="block pl-3 -ml-px border-l border-transparent hover:border-primary text-muted-foreground hover:text-foreground leading-snug">{t.label}</a></li>
            ))}
          </ul>
        </nav>
      )}

      <article className="max-w-3xl font-sans" onClick={onBodyClick}>
        {/* Opener */}
        <header className="mb-8">
          {ch.number ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Chapter {ch.number}</p> : null}
          <h1 className="font-display text-3xl sm:text-4xl leading-tight text-foreground">{ch.title}</h1>
          {standards?.length ? (
            <div className="flex flex-wrap gap-1.5 mt-3">{standards.map((s) => <Badge key={s.code} variant="secondary" title={s.description} className="text-[11px] font-normal">{s.code}</Badge>)}</div>
          ) : null}
          {ch.hook && <p className="mt-5 text-lg leading-relaxed text-foreground/90 italic" dangerouslySetInnerHTML={rich(ch.hook)} />}
        </header>

        {(ch.before_you_read.preview || ch.before_you_read.guiding_questions.length > 0) && (
          <section id="before" className="rounded-2xl border border-primary/30 bg-primary/5 p-5 mb-8 scroll-mt-4">
            <h2 className="flex items-center gap-2 font-semibold text-primary mb-2"><BookOpen className="h-4 w-4" /> Before You Read</h2>
            {ch.before_you_read.preview && <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={rich(ch.before_you_read.preview)} />}
            {ch.before_you_read.prior_knowledge_prompt && <p className="text-sm mt-2"><span className="font-semibold">Think first:</span> <span dangerouslySetInnerHTML={rich(ch.before_you_read.prior_knowledge_prompt)} /></p>}
            {ch.before_you_read.guiding_questions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Guiding questions</p>
                <ol className="list-decimal pl-5 text-sm space-y-1">{ch.before_you_read.guiding_questions.map((q, i) => <li key={i} dangerouslySetInnerHTML={rich(q)} />)}</ol>
              </div>
            )}
          </section>
        )}

        {ch.objectives.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Learning Objectives</h2>
            <ul className="list-disc pl-5 text-sm space-y-1">{ch.objectives.map((o, i) => <li key={i} dangerouslySetInnerHTML={rich(o)} />)}</ul>
          </section>
        )}

        {ch.sections.map((sec, si) => (
          <section key={si} id={`sec-${si}`} className="mb-10 scroll-mt-4">
            <h2 className="font-display text-2xl text-foreground mb-3 flex items-baseline gap-3">
              {sec.number && <span className="text-primary text-lg font-semibold tabular-nums">{sec.number}</span>}
              {sec.heading}
              {sec.role && <span className="ml-2 align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground">{SECTION_ROLE_LABEL[sec.role]}</span>}
            </h2>
            <div className="space-y-4">
              {sec.blocks.map((b, bi) => {
                if (b.type === "paragraph") return <p key={bi} className="leading-relaxed text-foreground/90" dangerouslySetInnerHTML={rich(b.text)} />;
                if (b.type === "callout") {
                  const { icon: Icon, cls } = CALLOUT_STYLE[b.kind];
                  return (
                    <aside key={bi} className={cn("rounded-xl border-l-4 border p-4 my-5", cls)}>
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-1"><Icon className="h-4 w-4" /> {b.title || CALLOUT_LABEL[b.kind]}</p>
                      <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={rich(b.text)} />
                    </aside>
                  );
                }
                return (
                  <figure key={bi} className="my-6">
                    {b.image_url ? (
                      <img src={b.image_url} alt={b.alt ?? b.caption} loading="lazy" className="w-full rounded-xl border border-border" />
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
                        <p className="text-[11px] uppercase tracking-wide mb-1">Figure not yet illustrated</p>
                        <p>{b.description}</p>
                      </div>
                    )}
                    <figcaption className="mt-2 text-sm text-muted-foreground">{b.caption}</figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ))}

        {ch.real_world.paragraphs.length > 0 && (
          <section id="real-world" className="mb-10 rounded-2xl border border-border bg-card p-6 scroll-mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-1">In the Real World</p>
            {ch.real_world.title && <h2 className="font-display text-2xl mb-3">{ch.real_world.title}</h2>}
            <div className="space-y-3">{ch.real_world.paragraphs.map((p, i) => <p key={i} className="leading-relaxed text-foreground/90" dangerouslySetInnerHTML={rich(p)} />)}</div>
          </section>
        )}

        {ch.summary.length > 0 && (
          <section id="summary" className="mb-10 scroll-mt-4">
            <h2 className="font-display text-2xl mb-3">Chapter Summary</h2>
            <ul className="space-y-2">{ch.summary.map((x, i) => <li key={i} className="flex gap-3 text-sm leading-relaxed"><span className="text-primary font-semibold">•</span><span dangerouslySetInnerHTML={rich(x)} /></li>)}</ul>
          </section>
        )}

        {ch.review_questions.length > 0 && (
          <section id="review" className="mb-10 scroll-mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-2xl">Reading Comprehension Questions</h2>
              {teacherMode && (
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setAllAnswers((v) => !v)}>
                  {allAnswers ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {allAnswers ? "Hide answer key" : "Show answer key"}
                </Button>
              )}
            </div>
            <ol className="space-y-3">
              {ch.review_questions.map((q, i) => {
                const open = allAnswers || revealed.has(i);
                return (
                  <li key={i} className="rounded-xl border border-border p-4">
                    <div className="flex items-start gap-3">
                      <span className="font-semibold text-primary tabular-nums">{i + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={rich(q.question)} />
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-normal">DOK {q.dok}</Badge>
                          {q.answer && !allAnswers && (
                            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setRevealed((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}>
                              {open ? "Hide answer" : "Check your answer"}
                            </button>
                          )}
                        </div>
                        {open && q.answer && <p className="mt-2 text-sm text-muted-foreground border-l-2 border-primary/40 pl-3" dangerouslySetInnerHTML={rich(q.answer)} />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {ch.glossary.length > 0 && (
          <section id="glossary" className="mb-10 scroll-mt-4">
            <h2 className="font-display text-2xl mb-3">Key Terms</h2>
            <dl className="grid sm:grid-cols-2 gap-3">
              {ch.glossary.map((g, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/30 p-3">
                  <dt className="font-semibold text-sm">{g.term}</dt>
                  <dd className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(inlineToHtml(g.definition)) }} />
                </div>
              ))}
            </dl>
          </section>
        )}

        {(prev || next) && (
          <footer className="flex items-center justify-between gap-3 border-t border-border pt-5 mt-6">
            {prev ? <Button variant="outline" size="sm" className="gap-1 max-w-[45%]" onClick={prev.onClick}><ChevronLeft className="h-4 w-4 shrink-0" /><span className="truncate">{prev.title}</span></Button> : <span />}
            {next ? <Button variant="outline" size="sm" className="gap-1 max-w-[45%]" onClick={next.onClick}><span className="truncate">{next.title}</span><ChevronRight className="h-4 w-4 shrink-0" /></Button> : <span />}
          </footer>
        )}
      </article>

      {activeTerm && (
        <div role="dialog" aria-label={`Definition of ${activeTerm.term}`} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[120] w-[min(92vw,520px)] rounded-2xl border border-primary/30 bg-card shadow-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-primary">Definition</p>
              <p className="font-semibold">{activeTerm.term}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(inlineToHtml(activeTerm.definition)) }} />
            </div>
            <button type="button" aria-label="Close definition" onClick={() => setActiveTerm(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
