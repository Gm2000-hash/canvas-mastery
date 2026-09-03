import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight } from "lucide-react";
import { MediaPlayer } from "./MediaPlayer";
import type { FlashcardsContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: FlashcardsContent; }

export function FlashcardsPlayer({ content }: Props) {
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState<boolean[]>([]);
  const card = content.cards[idx];
  if (!card) return null;

  const check = () => {
    setRevealed(true);
    const correct = answer.trim().toLowerCase() === card.definition.trim().toLowerCase();
    setScores(prev => { const n = [...prev]; n[idx] = correct; return n; });
  };

  const next = () => {
    if (idx < content.cards.length - 1) {
      setIdx(i => i + 1); setAnswer(""); setRevealed(false);
    }
  };

  const done = idx === content.cards.length - 1 && revealed;
  const totalCorrect = scores.filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{idx + 1} / {content.cards.length}</span>
        {scores.length > 0 && <span className="text-xs text-muted-foreground">{totalCorrect} correct</span>}
      </div>
      <div className="rounded-2xl border-2 border-border p-6 text-center space-y-3">
        <p className="text-lg font-semibold">{card.term}</p>
        {card.imageUrl && <img src={card.imageUrl} alt={card.term} className="mx-auto max-h-40 rounded-lg" />}
        <MediaPlayer media={card.media} />
      </div>
      {!revealed ? (
        <div className="flex gap-2">
          <Input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type the definition..." onKeyDown={e => e.key === "Enter" && check()} />
          <Button onClick={check} disabled={!answer.trim()}>Check</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={`rounded-xl p-3 text-sm ${scores[idx] ? "bg-green-50 border border-green-200" : "bg-destructive/5 border border-destructive/20"}`}>
            <p className="font-medium">{scores[idx] ? "Correct!" : "Not quite."}</p>
            <p className="text-muted-foreground mt-1">Answer: {card.definition}</p>
          </div>
          {!done && <Button onClick={next}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>}
          {done && (
            <div className="text-center py-3">
              <p className="font-semibold">Complete! {totalCorrect}/{content.cards.length}</p>
              <Button variant="outline" className="mt-2" onClick={() => { setIdx(0); setAnswer(""); setRevealed(false); setScores([]); }}>Restart</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
