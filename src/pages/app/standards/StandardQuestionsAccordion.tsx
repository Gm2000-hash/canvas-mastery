// Inline accordion that loads & shows the quiz questions tagged to a single
// standard. Used by the Standards library list so teachers can drill into a
// standard's questions without leaving the page.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { QuestionDrawer, bandColor, type QuestionRow } from "./QuestionsTab";

export default function StandardQuestionsAccordion({ standardId }: { standardId: string }) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [openQuestion, setOpenQuestion] = useState<QuestionRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // 1) Load all question_standards rows that point at this standard, with
      //    their question + assignment metadata. We include both confirmed and
      //    AI-suggested tags so the accordion shows the full picture.
      const { data: tagRows, error } = await supabase
        .from("question_standards")
        .select(
          "question_id, ai_suggested, confirmed, quiz_questions!inner(id, position, question_text, points_possible, assignment_id, answers, item_type, assignments!inner(id, name, course_id))",
        )
        .eq("standard_id", standardId);
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setQuestions([]);
        setLoading(false);
        return;
      }

      // 2) Collapse to one row per question, also tracking whether any tag for
      //    that question is confirmed (so we can show an "AI" pill when not).
      const byId = new Map<string, QuestionRow & { _anyConfirmed: boolean }>();
      for (const t of (tagRows as any[]) ?? []) {
        const q = t.quiz_questions;
        if (!q) continue;
        if (!byId.has(q.id)) {
          byId.set(q.id, {
            id: q.id,
            position: q.position,
            question_text: q.question_text,
            points_possible: q.points_possible,
            assignment_id: q.assignment_id,
            assignments: q.assignments,
            answers: q.answers ?? null,
            item_type: q.item_type ?? null,
            standards: [],
            _anyConfirmed: false,
          });
        }
        const row = byId.get(q.id)!;
        if (t.confirmed) row._anyConfirmed = true;
      }
      const list: QuestionRow[] = Array.from(byId.values()).map((r) => ({
        ...r,
        is_suggested_only: !r._anyConfirmed,
      }));

      // 3) Per-question response stats (avg pct + count) for the right-side
      //    metric on each card.
      if (list.length > 0) {
        const ids = list.map((q) => q.id);
        const { data: responses } = await supabase
          .from("question_responses")
          .select("question_id, points, points_possible")
          .in("question_id", ids);
        const stats = new Map<string, { n: number; sumPct: number }>();
        for (const r of (responses ?? []) as any[]) {
          const pp = Number(r.points_possible);
          if (!pp || pp <= 0 || r.points == null) continue;
          const pct = Math.max(0, Math.min(1, Number(r.points) / pp));
          const cur = stats.get(r.question_id) ?? { n: 0, sumPct: 0 };
          cur.n += 1;
          cur.sumPct += pct;
          stats.set(r.question_id, cur);
        }
        for (const q of list) {
          const s = stats.get(q.id);
          q.response_count = s?.n ?? 0;
          q.avg_pct = s && s.n > 0 ? s.sumPct / s.n : null;
        }
      }

      // Sort weakest-performing first so teachers see the trouble spots up top.
      list.sort((a, b) => {
        const ap = a.avg_pct ?? 999;
        const bp = b.avg_pct ?? 999;
        if (ap !== bp) return ap - bp;
        return (a.position ?? 0) - (b.position ?? 0);
      });

      setQuestions(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [standardId]);

  if (loading) {
    return (
      <div className="space-y-2 p-4 bg-muted/20">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground bg-muted/20">
        No questions tagged to this standard yet. Tag questions from{" "}
        <span className="font-medium text-foreground">Tag Review</span>.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 bg-muted/20">
      {questions.map((q) => (
        <button
          key={q.id}
          type="button"
          onClick={() => setOpenQuestion(q)}
          className="w-full text-left rounded-lg border bg-card hover:bg-muted/40 transition p-3 flex items-start gap-3"
        >
          <div className="shrink-0 text-xs text-muted-foreground tabular-nums w-10 pt-0.5">
            Q{q.position ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm line-clamp-2">
              {q.question_text || <span className="italic text-muted-foreground">(no text)</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {q.assignments?.name && (
                <Badge variant="outline" className="text-[11px]">
                  {q.assignments.name}
                </Badge>
              )}
              {q.is_suggested_only && (
                <Badge className="text-[11px] bg-accent/15 text-accent border-accent/30 hover:bg-accent/15">
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI
                </Badge>
              )}
              {q.points_possible != null && (
                <span className="text-[11px] text-muted-foreground">{q.points_possible} pts</span>
              )}
            </div>
          </div>
          <div className="shrink-0 w-24 text-right">
            {q.avg_pct != null ? (
              <>
                <div
                  className="text-base font-semibold tabular-nums"
                  style={{ color: bandColor(q.avg_pct) }}
                >
                  {Math.round(q.avg_pct * 100)}%
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {q.response_count ?? 0} responses
                </div>
              </>
            ) : (
              <div className="text-[11px] text-muted-foreground italic">No scores</div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        </button>
      ))}

      <QuestionDrawer question={openQuestion} onClose={() => setOpenQuestion(null)} />
    </div>
  );
}
