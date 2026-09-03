import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import type { DragTheWordsContent } from "@/modules/curriculum/lib/h5p-types";

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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function DragTheWordsPlayer({ content }: DragTheWordsContent extends never ? never : { content: DragTheWordsContent }) {
  const segments = useMemo(() => parseSegments(content.text), [content.text]);
  const blanks = useMemo(() => segments.filter(s => s.isBlank), [segments]);
  const shuffledWords = useMemo(() => shuffle(blanks.map(b => b.answer)), [blanks]);

  const [placed, setPlaced] = useState<(string | null)[]>(Array(blanks.length).fill(null));
  const [bank, setBank] = useState<string[]>(shuffledWords);
  const [checked, setChecked] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const handleDragStart = (word: string) => setDragging(word);

  const handleDrop = useCallback((blankIdx: number) => {
    if (!dragging) return;
    setPlaced(prev => {
      const next = [...prev];
      // If this slot already has a word, put it back
      if (next[blankIdx]) {
        setBank(b => [...b, next[blankIdx]!]);
      }
      next[blankIdx] = dragging;
      return next;
    });
    setBank(b => b.filter((w, i) => {
      // Remove first occurrence
      const idx = b.indexOf(dragging!);
      return i !== idx;
    }));
    setDragging(null);
    setChecked(false);
  }, [dragging]);

  const removeFromSlot = (blankIdx: number) => {
    const word = placed[blankIdx];
    if (!word) return;
    setPlaced(prev => { const n = [...prev]; n[blankIdx] = null; return n; });
    setBank(b => [...b, word]);
    setChecked(false);
  };

  const results = useMemo(() => {
    if (!checked) return null;
    return blanks.map((b, i) => (placed[i] ?? "").toLowerCase() === b.answer.toLowerCase());
  }, [checked, placed, blanks]);

  const score = results ? results.filter(Boolean).length : 0;

  const reset = () => {
    setPlaced(Array(blanks.length).fill(null));
    setBank(shuffle(blanks.map(b => b.answer)));
    setChecked(false);
  };

  let blankIdx = 0;

  return (
    <div className="space-y-6">
      {/* Word bank */}
      <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-dashed border-border bg-muted/30 min-h-[48px]">
        {bank.length === 0 && <span className="text-xs text-muted-foreground italic">All words placed!</span>}
        {bank.map((word, i) => (
          <Badge
            key={`${word}-${i}`}
            draggable
            onDragStart={() => handleDragStart(word)}
            className="cursor-grab active:cursor-grabbing bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 select-none"
          >
            {word}
          </Badge>
        ))}
      </div>

      {/* Text with drop zones */}
      <div className="text-sm leading-loose flex flex-wrap items-center gap-1">
        {segments.map((seg, i) => {
          if (!seg.isBlank) return <span key={i}>{seg.text}</span>;
          const idx = blankIdx++;
          const word = placed[idx];
          const isCorrect = results ? results[idx] : null;
          return (
            <span
              key={i}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
              onClick={() => word && removeFromSlot(idx)}
              className={`inline-flex items-center gap-1 min-w-[80px] h-8 px-2 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
                word ? (
                  isCorrect === true ? "border-green-500 bg-green-50" :
                  isCorrect === false ? "border-destructive bg-destructive/5" :
                  "border-primary/40 bg-primary/5"
                ) : "border-muted-foreground/30 bg-muted/20"
              }`}
              title={word ? "Click to remove" : "Drop a word here"}
            >
              {word && <span className="text-sm font-medium">{word}</span>}
              {isCorrect === true && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
              {isCorrect === false && <XCircle className="h-3.5 w-3.5 text-destructive" />}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => setChecked(true)} disabled={checked || placed.some(p => !p)}>
          Check Answers
        </Button>
        {checked && (
          <>
            <Button variant="outline" onClick={reset}>Retry</Button>
            <span className="text-sm font-medium text-muted-foreground">{score}/{blanks.length} correct</span>
          </>
        )}
      </div>
    </div>
  );
}
