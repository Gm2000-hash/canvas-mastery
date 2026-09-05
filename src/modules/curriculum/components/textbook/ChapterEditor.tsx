import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Image as ImageIcon, Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { CALLOUT_LABEL, renumberChapter, type CalloutKind, type ChapterBlock, type ChapterSection, type TextbookChapter } from "@/modules/curriculum/lib/textbook-chapter";
import { cn } from "@/lib/utils";

interface Props {
  chapter: TextbookChapter;
  onChange: (c: TextbookChapter) => void;
  standards?: { code: string; description: string }[];
  className?: string;
}

type InsertKind = "section" | "callout" | "figure" | "review_question" | "summary_point" | "guiding_question" | "objective" | "key_term" | "paragraph";

function RowTools({ onUp, onDown, onDelete, canUp, canDown }: { onUp: () => void; onDown: () => void; onDelete: () => void; canUp: boolean; canDown: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 shrink-0">
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onUp} disabled={!canUp} aria-label="Move up"><ArrowUp className="h-3 w-3" /></Button>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onDown} disabled={!canDown} aria-label="Move down"><ArrowDown className="h-3 w-3" /></Button>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete} aria-label="Delete"><Trash2 className="h-3 w-3" /></Button>
    </div>
  );
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir; if (j < 0 || j >= arr.length) return arr;
  const out = [...arr]; [out[i], out[j]] = [out[j], out[i]]; return out;
}

/** Simple list editor used for objectives, guiding questions, summary bullets. */
function StringList({ items, onChange, placeholder, multiline }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; multiline?: boolean }) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-1">
          {multiline
            ? <Textarea value={it} rows={2} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} placeholder={placeholder} className="text-sm" />
            : <Input value={it} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} placeholder={placeholder} className="text-sm" />}
          <RowTools canUp={i > 0} canDown={i < items.length - 1} onUp={() => onChange(move(items, i, -1))} onDown={() => onChange(move(items, i, 1))} onDelete={() => onChange(items.filter((_, k) => k !== i))} />
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => onChange([...items, ""])}><Plus className="h-3 w-3" /> Add</Button>
    </div>
  );
}

export function ChapterEditor({ chapter, onChange, standards = [], className }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [figureBusy, setFigureBusy] = useState<string | null>(null);
  const ch = chapter;
  const set = (patch: Partial<TextbookChapter>) => onChange(renumberChapter({ ...ch, ...patch }));
  const setSection = (i: number, patch: Partial<ChapterSection>) => set({ sections: ch.sections.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const setBlock = (si: number, bi: number, b: ChapterBlock) => setSection(si, { blocks: ch.sections[si].blocks.map((x, k) => (k === bi ? b : x)) });

  async function aiInsert(kind: InsertKind, sectionIdx?: number) {
    const key = `${kind}-${sectionIdx ?? "x"}`;
    setBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke("generate-reading-insert", {
        body: { kind, section: sectionIdx != null ? `${ch.sections[sectionIdx]?.number ?? ""} ${ch.sections[sectionIdx]?.heading ?? ""}`.trim() : undefined, lesson: { title: ch.title, chapter: ch }, standards },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const r = data?.data ?? {};
      if (kind === "section") set({ sections: [...ch.sections, { heading: r.heading ?? "New section", blocks: Array.isArray(r.blocks) ? r.blocks : [] }] });
      else if (kind === "callout" && sectionIdx != null) setSection(sectionIdx, { blocks: [...ch.sections[sectionIdx].blocks, { type: "callout", kind: r.kind ?? "stop_and_think", text: r.text ?? "" }] });
      else if (kind === "figure" && sectionIdx != null) setSection(sectionIdx, { blocks: [...ch.sections[sectionIdx].blocks, { type: "figure", caption: r.caption ?? "", description: r.description ?? "", alt: r.alt ?? "", image_url: null }] });
      else if (kind === "paragraph" && sectionIdx != null) setSection(sectionIdx, { blocks: [...ch.sections[sectionIdx].blocks, { type: "paragraph", text: r.text ?? r.html ?? "" }] });
      else if (kind === "review_question") set({ review_questions: [...ch.review_questions, { question: r.question ?? "", dok: Number(r.dok) || 1, answer: r.answer ?? "" }] });
      else if (kind === "summary_point") set({ summary: [...ch.summary, r.text ?? ""] });
      else if (kind === "guiding_question") set({ before_you_read: { ...ch.before_you_read, guiding_questions: [...ch.before_you_read.guiding_questions, r.text ?? ""] } });
      else if (kind === "objective") set({ objectives: [...ch.objectives, r.text ?? ""] });
      else if (kind === "key_term") set({ glossary: [...ch.glossary, { term: r.term ?? "", definition: r.definition ?? "" }] });
      toast.success("Added");
    } catch (e: any) {
      toast.error(e?.message ?? "AI insert failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateFigure(si: number, bi: number) {
    const b = ch.sections[si].blocks[bi];
    if (b.type !== "figure") return;
    const key = `${si}-${bi}`;
    setFigureBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke("generate-chapter-figure", { body: { description: b.description, caption: b.caption } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBlock(si, bi, { ...b, image_url: data.image_url });
      toast.success("Figure illustrated");
    } catch (e: any) {
      toast.error(e?.message ?? "Image generation failed");
    } finally {
      setFigureBusy(null);
    }
  }

  async function uploadFigure(si: number, bi: number, file: File) {
    const b = ch.sections[si].blocks[bi];
    if (b.type !== "figure") return;
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id; if (!uid) return;
    const path = `${uid}/chapter-figures/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("activity-media").upload(path, file, { contentType: file.type || undefined });
    if (error) { toast.error(error.message); return; }
    const { data } = await supabase.storage.from("activity-media").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (!data?.signedUrl) { toast.error("Could not link the uploaded image"); return; }
    setBlock(si, bi, { ...b, image_url: data.signedUrl });
  }

  const AiBtn = ({ kind, si, label }: { kind: InsertKind; si?: number; label: string }) => (
    <Button type="button" variant="outline" size="sm" className="text-xs gap-1" disabled={!!busy} onClick={() => aiInsert(kind, si)}>
      {busy === `${kind}-${si ?? "x"}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} {label}
    </Button>
  );

  return (
    <div className={cn("space-y-8 font-sans", className)}>
      {/* Opener */}
      <section className="space-y-3">
        <div className="space-y-1.5"><Label>Chapter title</Label><Input value={ch.title} onChange={(e) => set({ title: e.target.value })} className="text-lg font-semibold" /></div>
        <div className="space-y-1.5"><Label>Hook (opening paragraph)</Label><Textarea rows={3} value={ch.hook} onChange={(e) => set({ hook: e.target.value })} /></div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-semibold text-primary">Before You Read</p>
          <div className="space-y-1.5"><Label className="text-xs">Preview</Label><Textarea rows={2} value={ch.before_you_read.preview} onChange={(e) => set({ before_you_read: { ...ch.before_you_read, preview: e.target.value } })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Prior-knowledge prompt</Label><Input value={ch.before_you_read.prior_knowledge_prompt} onChange={(e) => set({ before_you_read: { ...ch.before_you_read, prior_knowledge_prompt: e.target.value } })} /></div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><Label className="text-xs">Guiding questions</Label><AiBtn kind="guiding_question" label="AI question" /></div>
            <StringList items={ch.before_you_read.guiding_questions} onChange={(v) => set({ before_you_read: { ...ch.before_you_read, guiding_questions: v } })} placeholder="What causes…?" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between"><Label>Learning objectives</Label><AiBtn kind="objective" label="AI objective" /></div>
          <StringList items={ch.objectives} onChange={(v) => set({ objectives: v })} placeholder="Students will be able to…" />
        </div>
      </section>

      {/* Sections */}
      {ch.sections.map((sec, si) => (
        <section key={si} className="rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="mt-2 tabular-nums">{sec.number}</Badge>
            <Input value={sec.heading} onChange={(e) => setSection(si, { heading: e.target.value })} className="font-semibold" placeholder="Section heading" />
            <RowTools canUp={si > 0} canDown={si < ch.sections.length - 1} onUp={() => set({ sections: move(ch.sections, si, -1) })} onDown={() => set({ sections: move(ch.sections, si, 1) })} onDelete={() => set({ sections: ch.sections.filter((_, k) => k !== si) })} />
          </div>
          {sec.blocks.map((b, bi) => (
            <div key={bi} className="flex items-start gap-1">
              <div className="flex-1 min-w-0">
                {b.type === "paragraph" && <Textarea rows={4} value={b.text} onChange={(e) => setBlock(si, bi, { ...b, text: e.target.value })} placeholder="Paragraph — use **bold** for vocabulary" className="text-sm leading-relaxed" />}
                {b.type === "callout" && (
                  <div className="rounded-xl border-l-4 border-primary/50 bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={b.kind} onValueChange={(v) => setBlock(si, bi, { ...b, kind: v as CalloutKind })}>
                        <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{(Object.keys(CALLOUT_LABEL) as CalloutKind[]).map((k) => <SelectItem key={k} value={k}>{CALLOUT_LABEL[k]}</SelectItem>)}</SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">Callout box</span>
                    </div>
                    <Textarea rows={2} value={b.text} onChange={(e) => setBlock(si, bi, { ...b, text: e.target.value })} className="text-sm" />
                  </div>
                )}
                {b.type === "figure" && (
                  <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Figure</div>
                    {b.image_url && <img src={b.image_url} alt={b.alt ?? b.caption} className="max-h-56 rounded-lg border border-border" />}
                    <Input value={b.caption} onChange={(e) => setBlock(si, bi, { ...b, caption: e.target.value })} placeholder="Caption" className="text-sm" />
                    <Textarea rows={2} value={b.description} onChange={(e) => setBlock(si, bi, { ...b, description: e.target.value })} placeholder="Illustrator brief (what the image should show)" className="text-xs" />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="text-xs gap-1" disabled={!!figureBusy || !b.description.trim()} onClick={() => generateFigure(si, bi)}>
                        {figureBusy === `${si}-${bi}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} {b.image_url ? "Regenerate image" : "Generate image"}
                      </Button>
                      <label className="inline-flex items-center gap-1 text-xs cursor-pointer rounded-md border border-input px-2.5 h-8 hover:bg-accent/50">
                        <Upload className="h-3 w-3" /> Upload image
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFigure(si, bi, f); e.target.value = ""; }} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <RowTools canUp={bi > 0} canDown={bi < sec.blocks.length - 1} onUp={() => setSection(si, { blocks: move(sec.blocks, bi, -1) })} onDown={() => setSection(si, { blocks: move(sec.blocks, bi, 1) })} onDelete={() => setSection(si, { blocks: sec.blocks.filter((_, k) => k !== bi) })} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => setSection(si, { blocks: [...sec.blocks, { type: "paragraph", text: "" }] })}><Plus className="h-3 w-3" /> Paragraph</Button>
            <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => setSection(si, { blocks: [...sec.blocks, { type: "callout", kind: "stop_and_think", text: "" }] })}><Plus className="h-3 w-3" /> Callout</Button>
            <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => setSection(si, { blocks: [...sec.blocks, { type: "figure", caption: "", description: "", image_url: null }] })}><Plus className="h-3 w-3" /> Figure</Button>
            <span className="mx-1 border-l border-border" />
            <AiBtn kind="paragraph" si={si} label="AI paragraph" />
            <AiBtn kind="callout" si={si} label="AI callout" />
            <AiBtn kind="figure" si={si} label="AI figure" />
          </div>
        </section>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => set({ sections: [...ch.sections, { heading: "", blocks: [{ type: "paragraph", text: "" }] }] })}><Plus className="h-3.5 w-3.5" /> Add section</Button>
        <AiBtn kind="section" label="AI section" />
      </div>

      {/* Real world */}
      <section className="rounded-2xl border border-border p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">In the Real World</p>
        <Input value={ch.real_world.title} onChange={(e) => set({ real_world: { ...ch.real_world, title: e.target.value } })} placeholder="Case study or event title" className="font-semibold" />
        <StringList multiline items={ch.real_world.paragraphs} onChange={(v) => set({ real_world: { ...ch.real_world, paragraphs: v } })} placeholder="Paragraph" />
      </section>

      {/* Summary */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between"><Label>Chapter summary</Label><AiBtn kind="summary_point" label="AI bullet" /></div>
        <StringList items={ch.summary} onChange={(v) => set({ summary: v })} placeholder="One main idea per bullet" />
      </section>

      {/* Review questions */}
      <section className="space-y-2">
        <div className="flex items-center justify-between"><Label>Review questions</Label><AiBtn kind="review_question" label="AI question" /></div>
        {ch.review_questions.map((q, i) => (
          <div key={i} className="flex items-start gap-1">
            <div className="flex-1 rounded-xl border border-border p-3 space-y-2">
              <div className="flex gap-2">
                <Input value={q.question} onChange={(e) => set({ review_questions: ch.review_questions.map((x, k) => (k === i ? { ...x, question: e.target.value } : x)) })} placeholder="Question" className="text-sm" />
                <Select value={String(q.dok)} onValueChange={(v) => set({ review_questions: ch.review_questions.map((x, k) => (k === i ? { ...x, dok: Number(v) } : x)) })}>
                  <SelectTrigger className="w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4].map((d) => <SelectItem key={d} value={String(d)}>DOK {d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input value={q.answer ?? ""} onChange={(e) => set({ review_questions: ch.review_questions.map((x, k) => (k === i ? { ...x, answer: e.target.value } : x)) })} placeholder="Model answer (teacher key)" className="text-xs" />
            </div>
            <RowTools canUp={i > 0} canDown={i < ch.review_questions.length - 1} onUp={() => set({ review_questions: move(ch.review_questions, i, -1) })} onDown={() => set({ review_questions: move(ch.review_questions, i, 1) })} onDelete={() => set({ review_questions: ch.review_questions.filter((_, k) => k !== i) })} />
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => set({ review_questions: [...ch.review_questions, { question: "", dok: 1, answer: "" }] })}><Plus className="h-3 w-3" /> Add question</Button>
      </section>

      {/* Glossary */}
      <section className="space-y-2">
        <div className="flex items-center justify-between"><Label>Glossary</Label><AiBtn kind="key_term" label="AI term" /></div>
        {ch.glossary.map((g, i) => (
          <div key={i} className="flex items-start gap-1">
            <Input value={g.term} onChange={(e) => set({ glossary: ch.glossary.map((x, k) => (k === i ? { ...x, term: e.target.value } : x)) })} placeholder="Term" className="w-44 text-sm font-semibold" />
            <Input value={g.definition} onChange={(e) => set({ glossary: ch.glossary.map((x, k) => (k === i ? { ...x, definition: e.target.value } : x)) })} placeholder="Student-friendly definition" className="text-sm" />
            <RowTools canUp={i > 0} canDown={i < ch.glossary.length - 1} onUp={() => set({ glossary: move(ch.glossary, i, -1) })} onDown={() => set({ glossary: move(ch.glossary, i, 1) })} onDelete={() => set({ glossary: ch.glossary.filter((_, k) => k !== i) })} />
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => set({ glossary: [...ch.glossary, { term: "", definition: "" }] })}><Plus className="h-3 w-3" /> Add term</Button>
      </section>
    </div>
  );
}
