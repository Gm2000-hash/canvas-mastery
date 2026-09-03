import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { RichContent } from "./RichContent";
import { MediaPlayer } from "./MediaPlayer";
import type { InteractiveBookContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: InteractiveBookContent; }

export function InteractiveBookPlayer({ content }: Props) {
  const [chIdx, setChIdx] = useState(0);
  const ch = content.chapters[chIdx];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">{content.title}</h3>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {content.chapters.map((c, i) => (
          <Button key={c.id} variant={i === chIdx ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setChIdx(i)}>
            {i + 1}. {c.title}
          </Button>
        ))}
      </div>
      {ch && (
        <div className="rounded-xl border border-border p-6 min-h-[200px]">
          <h4 className="text-lg font-semibold mb-3">{ch.title}</h4>
          <RichContent html={ch.content} />
          <MediaPlayer media={ch.media} className="mt-4" />
        </div>
      )}
      <div className="flex justify-between">
        <Button size="sm" variant="outline" disabled={chIdx === 0} onClick={() => setChIdx(i => i - 1)}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <Button size="sm" variant="outline" disabled={chIdx === content.chapters.length - 1} onClick={() => setChIdx(i => i + 1)}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
