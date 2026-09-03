import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { RichContent } from "./RichContent";
import type { MultipleChoiceContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: MultipleChoiceContent; }

export function MultipleChoicePlayer({ content }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);

  const toggle = (id: string) => {
    if (checked) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (content.multiAnswer) {
        next.has(id) ? next.delete(id) : next.add(id);
      } else {
        next.clear(); next.add(id);
      }
      return next;
    });
  };

  const correctIds = new Set(content.options.filter(o => o.correct).map(o => o.id));
  const isCorrect = checked && selected.size === correctIds.size && [...selected].every(id => correctIds.has(id));

  return (
    <div className="space-y-4">
      <RichContent html={content.question} className="font-medium" />
      <div className="space-y-2">
        {content.options.map(opt => {
          const isSel = selected.has(opt.id);
          const showCorrect = checked && opt.correct;
          const showWrong = checked && isSel && !opt.correct;
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors text-sm ${
                showCorrect ? "border-green-500 bg-green-50" :
                showWrong ? "border-destructive bg-destructive/5" :
                isSel ? "border-primary bg-primary/5" :
                "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1">{opt.text}</span>
                {showCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                {showWrong && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => setChecked(true)} disabled={checked || selected.size === 0}>Check</Button>
        {checked && (
          <>
            <Button variant="outline" onClick={() => { setSelected(new Set()); setChecked(false); }}>Retry</Button>
            <span className={`text-sm font-medium ${isCorrect ? "text-green-600" : "text-destructive"}`}>
              {isCorrect ? "Correct!" : "Not quite — try again."}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
