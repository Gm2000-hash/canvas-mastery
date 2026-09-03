import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { MarkTheWordsContent } from "@/modules/curriculum/lib/h5p-types";

function parseWords(text: string) {
  const regex = /\*([^*]+)\*/g;
  const clean = text.replace(regex, "$1");
  const words = clean.split(/(\s+)/);
  
  // Build answer set from original
  const correctWords = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    correctWords.add(match[1].toLowerCase());
  }
  
  return { words, correctWords };
}

interface Props { content: MarkTheWordsContent; }

export function MarkTheWordsPlayer({ content }: Props) {
  const { words, correctWords } = useMemo(() => parseWords(content.text), [content.text]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);

  const toggle = (idx: number) => {
    if (checked) return;
    const word = words[idx].trim();
    if (!word) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const totalCorrect = words.filter(w => correctWords.has(w.trim().toLowerCase())).length;
  const score = checked ? words.filter((w, i) => selected.has(i) && correctWords.has(w.trim().toLowerCase())).length : 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Click on the correct words in the text below.</p>
      <div className="text-sm leading-loose flex flex-wrap">
        {words.map((word, i) => {
          const isWord = word.trim().length > 0;
          if (!isWord) return <span key={i}>{word}</span>;
          const isSel = selected.has(i);
          const isCorrectWord = correctWords.has(word.trim().toLowerCase());
          const showGreen = checked && isSel && isCorrectWord;
          const showRed = checked && isSel && !isCorrectWord;
          const showMissed = checked && !isSel && isCorrectWord;
          return (
            <span
              key={i}
              onClick={() => toggle(i)}
              className={`cursor-pointer px-1 py-0.5 rounded transition-colors ${
                showGreen ? "bg-green-100 text-green-700 font-medium" :
                showRed ? "bg-destructive/10 text-destructive line-through" :
                showMissed ? "bg-amber-100 text-amber-700 underline" :
                isSel ? "bg-primary/10 text-primary font-medium" :
                "hover:bg-muted"
              }`}
            >
              {word}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => setChecked(true)} disabled={checked || selected.size === 0}>Check</Button>
        {checked && (
          <>
            <Button variant="outline" onClick={() => { setSelected(new Set()); setChecked(false); }}>Retry</Button>
            <span className="text-sm font-medium text-muted-foreground">{score}/{totalCorrect} correct</span>
          </>
        )}
      </div>
    </div>
  );
}
