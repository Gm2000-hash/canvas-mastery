import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle } from "lucide-react";
import type { FillInBlanksContent } from "@/modules/curriculum/lib/h5p-types";

interface Props {
  content: FillInBlanksContent;
}

function parseSegments(text: string) {
  const regex = /\*([^*]+)\*/g;
  const segments: { text: string; isBlank: boolean; answer: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), isBlank: false, answer: "" });
    }
    segments.push({ text: "", isBlank: true, answer: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isBlank: false, answer: "" });
  }
  return segments;
}

export function FillInBlanksPlayer({ content }: Props) {
  const segments = useMemo(() => parseSegments(content.text), [content.text]);
  const blankCount = segments.filter(s => s.isBlank).length;
  const [answers, setAnswers] = useState<string[]>(Array(blankCount).fill(""));
  const [checked, setChecked] = useState(false);

  let blankIdx = 0;

  const results = useMemo(() => {
    if (!checked) return null;
    let i = 0;
    return segments.filter(s => s.isBlank).map(s => {
      const userAnswer = answers[i++]?.trim().toLowerCase() ?? "";
      const correct = s.answer.toLowerCase();
      return userAnswer === correct;
    });
  }, [checked, answers, segments]);

  const score = results ? results.filter(Boolean).length : 0;

  return (
    <div className="space-y-6">
      <div className="text-sm leading-loose flex flex-wrap items-center gap-1">
        {segments.map((seg, i) => {
          if (!seg.isBlank) return <span key={i}>{seg.text}</span>;
          const idx = blankIdx++;
          const isCorrect = results ? results[idx] : null;
          return (
            <span key={i} className="inline-flex items-center gap-1">
              <Input
                className={`w-28 h-8 text-sm inline-block ${
                  isCorrect === true ? "border-green-500 bg-green-50" :
                  isCorrect === false ? "border-destructive bg-destructive/5" : ""
                }`}
                value={answers[idx]}
                onChange={e => {
                  const next = [...answers];
                  next[idx] = e.target.value;
                  setAnswers(next);
                  setChecked(false);
                }}
                disabled={checked}
                placeholder="..."
              />
              {isCorrect === true && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {isCorrect === false && (
                <span className="text-xs text-destructive font-medium">({seg.answer})</span>
              )}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => setChecked(true)} disabled={checked}>Check Answers</Button>
        {checked && (
          <>
            <Button variant="outline" onClick={() => { setAnswers(Array(blankCount).fill("")); setChecked(false); }}>
              Retry
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              {score}/{blankCount} correct
            </span>
          </>
        )}
      </div>
    </div>
  );
}
