import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";
import type { CrosswordContent } from "@/modules/curriculum/lib/h5p-types";

interface CellData { letter: string; wordIds: string[]; row: number; col: number; }

function buildGrid(words: CrosswordContent["words"]) {
  // Simple grid placement - place words sequentially
  const gridSize = Math.max(15, ...words.map(w => w.word.length + 2));
  const cells = new Map<string, CellData>();
  
  let nextRow = 1;
  let nextCol = 1;
  
  const placements: { word: typeof words[0]; row: number; col: number }[] = [];
  
  words.forEach((w) => {
    const row = w.direction === "across" ? nextRow : nextRow;
    const col = w.direction === "across" ? 1 : nextCol;
    placements.push({ word: w, row, col });
    
    for (let i = 0; i < w.word.length; i++) {
      const r = w.direction === "across" ? row : row + i;
      const c = w.direction === "across" ? col + i : col;
      const key = `${r}-${c}`;
      const existing = cells.get(key);
      cells.set(key, {
        letter: w.word[i],
        wordIds: existing ? [...existing.wordIds, w.id] : [w.id],
        row: r, col: c,
      });
    }
    
    if (w.direction === "across") nextRow += 2;
    else nextCol += 2;
  });
  
  return { cells, placements, gridSize: Math.min(gridSize, 20) };
}

interface Props { content: CrosswordContent; }

export function CrosswordPlayer({ content }: Props) {
  const { cells, placements, gridSize } = useMemo(() => buildGrid(content.words), [content.words]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const rows = Math.max(...[...cells.values()].map(c => c.row), 0);
  const cols = Math.max(...[...cells.values()].map(c => c.col), 0);

  const score = useMemo(() => {
    if (!checked) return null;
    let correct = 0;
    let total = 0;
    cells.forEach((cell, key) => {
      total++;
      if ((answers[key] ?? "").toUpperCase() === cell.letter.toUpperCase()) correct++;
    });
    return { correct, total };
  }, [checked, answers, cells]);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{content.title}</h3>
      
      {/* Grid */}
      <div className="overflow-auto">
        <div className="inline-grid gap-0" style={{ gridTemplateColumns: `repeat(${cols}, 32px)`, gridTemplateRows: `repeat(${rows}, 32px)` }}>
          {Array.from({ length: rows * cols }, (_, i) => {
            const r = Math.floor(i / cols) + 1;
            const c = (i % cols) + 1;
            const key = `${r}-${c}`;
            const cell = cells.get(key);
            if (!cell) return <div key={key} />;
            const isCorrect = checked && (answers[key] ?? "").toUpperCase() === cell.letter.toUpperCase();
            const isWrong = checked && !isCorrect;
            return (
              <input
                key={key}
                maxLength={1}
                className={`w-8 h-8 text-center text-xs font-bold uppercase border border-border focus:outline-none focus:ring-1 focus:ring-primary ${
                  isCorrect ? "bg-green-50 text-green-700" :
                  isWrong ? "bg-destructive/5 text-destructive" :
                  "bg-card"
                }`}
                value={answers[key] ?? ""}
                onChange={e => { setAnswers(prev => ({ ...prev, [key]: e.target.value })); setChecked(false); }}
                disabled={checked}
              />
            );
          })}
        </div>
      </div>

      {/* Clues */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Across</p>
          {content.words.filter(w => w.direction === "across").map((w, i) => (
            <p key={w.id} className="text-muted-foreground">{i + 1}. {w.clue}</p>
          ))}
        </div>
        <div>
          <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Down</p>
          {content.words.filter(w => w.direction === "down").map((w, i) => (
            <p key={w.id} className="text-muted-foreground">{i + 1}. {w.clue}</p>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => setChecked(true)} disabled={checked}>Check</Button>
        {checked && score && (
          <>
            <Button variant="outline" onClick={() => { setAnswers({}); setChecked(false); }}>Reset</Button>
            <span className="text-sm font-medium text-muted-foreground">{score.correct}/{score.total} letters correct</span>
          </>
        )}
      </div>
    </div>
  );
}
