import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { MemoryGameContent } from "@/modules/curriculum/lib/h5p-types";

interface MemCard { id: string; text: string; pairId: string; }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Props { content: MemoryGameContent; }

export function MemoryGamePlayer({ content }: Props) {
  const cards = useMemo(() => {
    const all: MemCard[] = [];
    content.pairs.forEach(p => {
      all.push({ id: `${p.id}-a`, text: p.cardA, pairId: p.id });
      all.push({ id: `${p.id}-b`, text: p.cardB, pairId: p.id });
    });
    return shuffle(all);
  }, [content.pairs]);

  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);

  const handleClick = useCallback((card: MemCard) => {
    if (matched.has(card.pairId) || flipped.includes(card.id) || flipped.length >= 2) return;
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length === 2) {
      setMoves(m => m + 1);
      const [a, b] = next.map(id => cards.find(c => c.id === id)!);
      if (a.pairId === b.pairId) {
        setMatched(prev => new Set([...prev, a.pairId]));
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  }, [flipped, matched, cards]);

  const allDone = matched.size === content.pairs.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Moves: {moves}</span>
        <span className="text-xs text-muted-foreground">Matched: {matched.size}/{content.pairs.length}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {cards.map(card => {
          const isFlipped = flipped.includes(card.id) || matched.has(card.pairId);
          return (
            <button
              key={card.id}
              onClick={() => handleClick(card)}
              className={`aspect-square rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center p-2 text-center ${
                matched.has(card.pairId) ? "border-green-400 bg-green-50 text-green-700" :
                isFlipped ? "border-primary bg-primary/5 text-primary" :
                "border-border bg-card hover:border-primary/40 text-transparent"
              }`}
            >
              {isFlipped ? card.text : "?"}
            </button>
          );
        })}
      </div>
      {allDone && (
        <div className="text-center space-y-2">
          <p className="font-semibold text-green-600">All matched in {moves} moves!</p>
          <Button variant="outline" onClick={() => { setFlipped([]); setMatched(new Set()); setMoves(0); }}>Play Again</Button>
        </div>
      )}
    </div>
  );
}
