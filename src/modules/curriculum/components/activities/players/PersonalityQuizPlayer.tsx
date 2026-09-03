import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { PersonalityQuizContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: PersonalityQuizContent; }

export function PersonalityQuizPlayer({ content }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(content.questions.map(() => null));
  const [done, setDone] = useState(false);

  const result = useMemo(() => {
    if (!done) return null;
    const scores: Record<string, number> = {};
    content.profiles.forEach(p => scores[p.id] = 0);
    content.questions.forEach((q, qi) => {
      const ai = answers[qi];
      if (ai !== null && q.options[ai]) {
        Object.entries(q.options[ai].profileScores).forEach(([pid, s]) => {
          scores[pid] = (scores[pid] || 0) + s;
        });
      }
    });
    const maxId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];
    return content.profiles.find(p => p.id === maxId) ?? null;
  }, [done, answers, content]);

  if (done && result) {
    return (
      <div className="text-center space-y-4 py-6">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Your result</p>
        <p className="text-2xl font-bold text-primary">{result.name}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{result.description}</p>
        <Button variant="outline" onClick={() => { setAnswers(content.questions.map(() => null)); setDone(false); }}>Retake</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {content.questions.map((q, qi) => (
        <div key={q.id} className="space-y-2">
          <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
          <div className="space-y-1.5 pl-3">
            {q.options.map((opt, oi) => (
              <button
                key={oi}
                onClick={() => setAnswers(prev => { const n = [...prev]; n[qi] = oi; return n; })}
                className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm transition-colors ${
                  answers[qi] === oi ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={() => setDone(true)} disabled={answers.some(a => a === null)}>See Results</Button>
    </div>
  );
}
