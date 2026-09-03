import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw, ChevronLeft, ChevronRight } from "lucide-react";
import { RichContent } from "./RichContent";
import { MediaPlayer } from "./MediaPlayer";
import type { DialogCardsContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: DialogCardsContent; }

export function DialogCardsPlayer({ content }: Props) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = content.cards[idx];
  if (!card) return null;

  const displayText = flipped ? card.back : card.front;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{idx + 1} / {content.cards.length}</span>
      </div>
      <div
        onClick={() => setFlipped(f => !f)}
        className="cursor-pointer min-h-[180px] rounded-2xl border-2 border-border flex items-center justify-center p-6 transition-all hover:shadow-md"
        style={{ perspective: "600px" }}
      >
        <div className="text-center space-y-2 w-full">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{flipped ? "Back" : "Front"}</p>
          <RichContent html={displayText} className="text-base" />
          <MediaPlayer media={card.media} className="mt-3" />
          <p className="text-xs text-muted-foreground">Click to flip</p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button size="icon" variant="outline" onClick={() => { setIdx(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={idx === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setFlipped(f => !f)}>
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={() => { setIdx(i => Math.min(content.cards.length - 1, i + 1)); setFlipped(false); }} disabled={idx === content.cards.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
