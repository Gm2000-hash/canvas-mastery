import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import type { TrueFalseContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: TrueFalseContent; }

export function TrueFalsePlayer({ content }: Props) {
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);
  const isCorrect = checked && answer === content.correctAnswer;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{content.statement}</p>
      <div className="flex gap-3">
        {[true, false].map(val => (
          <button
            key={String(val)}
            onClick={() => { if (!checked) setAnswer(val); }}
            className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
              checked && val === content.correctAnswer ? "border-green-500 bg-green-50" :
              checked && answer === val && val !== content.correctAnswer ? "border-destructive bg-destructive/5" :
              answer === val ? "border-primary bg-primary/5" :
              "border-border hover:border-primary/40"
            }`}
          >
            {val ? "True" : "False"}
          </button>
        ))}
      </div>
      {checked && content.feedback && (
        <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{content.feedback}</p>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={() => setChecked(true)} disabled={checked || answer === null}>Check</Button>
        {checked && (
          <>
            <Button variant="outline" onClick={() => { setAnswer(null); setChecked(false); }}>Retry</Button>
            <span className={`text-sm font-medium ${isCorrect ? "text-green-600" : "text-destructive"}`}>
              {isCorrect ? "Correct!" : "Incorrect."}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
