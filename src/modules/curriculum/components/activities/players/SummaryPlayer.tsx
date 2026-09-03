import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import type { SummaryContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: SummaryContent; }

export function SummaryPlayer({ content }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(content.groups.map(() => null));
  const [checked, setChecked] = useState(false);

  const select = (gi: number, si: number) => {
    if (checked) return;
    setAnswers(prev => { const n = [...prev]; n[gi] = si; return n; });
  };

  const score = checked ? content.groups.filter((g, i) => answers[i] === g.correctIndex).length : 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{content.intro}</p>
      {content.groups.map((g, gi) => (
        <div key={g.id} className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Group {gi + 1}</span>
          {g.statements.map((s, si) => {
            const isSel = answers[gi] === si;
            const isCorrect = checked && si === g.correctIndex;
            const isWrong = checked && isSel && si !== g.correctIndex;
            return (
              <button
                key={si}
                onClick={() => select(gi, si)}
                className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm transition-colors ${
                  isCorrect ? "border-green-500 bg-green-50" :
                  isWrong ? "border-destructive bg-destructive/5" :
                  isSel ? "border-primary bg-primary/5" :
                  "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1">{s}</span>
                  {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                  {isWrong && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button onClick={() => setChecked(true)} disabled={checked || answers.some(a => a === null)}>Check</Button>
        {checked && (
          <>
            <Button variant="outline" onClick={() => { setAnswers(content.groups.map(() => null)); setChecked(false); }}>Retry</Button>
            <span className="text-sm font-medium text-muted-foreground">{score}/{content.groups.length} correct</span>
          </>
        )}
      </div>
    </div>
  );
}
