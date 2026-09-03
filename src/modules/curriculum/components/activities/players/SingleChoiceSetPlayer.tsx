import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import type { SingleChoiceSetContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: SingleChoiceSetContent; }

export function SingleChoiceSetPlayer({ content }: Props) {
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = content.questions[qIdx];
  if (!q && !done) return null;

  const handleSelect = (oi: number) => {
    if (selected !== null) return;
    setSelected(oi);
    if (oi === q.correctIndex) setScore(s => s + 1);
    setTimeout(() => {
      if (qIdx + 1 < content.questions.length) {
        setQIdx(i => i + 1);
        setSelected(null);
      } else {
        setDone(true);
      }
    }, 1200);
  };

  if (done) {
    return (
      <div className="text-center space-y-3 py-6">
        <p className="text-lg font-semibold">Quiz Complete!</p>
        <p className="text-sm text-muted-foreground">{score}/{content.questions.length} correct</p>
        <Button onClick={() => { setQIdx(0); setSelected(null); setScore(0); setDone(false); }}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{q.question}</p>
        <span className="text-xs text-muted-foreground">{qIdx + 1}/{content.questions.length}</span>
      </div>
      <div className="space-y-2">
        {q.options.map((opt, oi) => (
          <button
            key={oi}
            onClick={() => handleSelect(oi)}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-colors ${
              selected === oi && oi === q.correctIndex ? "border-green-500 bg-green-50" :
              selected === oi ? "border-destructive bg-destructive/5" :
              selected !== null && oi === q.correctIndex ? "border-green-500 bg-green-50" :
              "border-border hover:border-primary/40"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
