import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { RichContent } from "./RichContent";
import { MediaPlayer } from "./MediaPlayer";
import type { VirtualTourContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: VirtualTourContent; }

export function VirtualTourPlayer({ content }: Props) {
  const [idx, setIdx] = useState(0);
  const scene = content.scenes[idx];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">{content.title}</h3>
        <span className="text-xs text-muted-foreground ml-auto">{idx + 1}/{content.scenes.length}</span>
      </div>
      {scene && (
        <div className="rounded-2xl border-2 border-border overflow-hidden">
          {scene.imageUrl ? (
            <img src={scene.imageUrl} alt={scene.title} className="w-full max-h-[300px] object-cover" />
          ) : (
            <div className="h-[200px] bg-muted/30 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No 360° image</p>
            </div>
          )}
          <div className="p-4 space-y-3">
            <h4 className="font-semibold text-sm">{scene.title}</h4>
            <RichContent html={scene.description} />
            <MediaPlayer media={scene.media} />
          </div>
        </div>
      )}
      <div className="flex justify-between">
        <Button size="sm" variant="outline" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <Button size="sm" variant="outline" disabled={idx === content.scenes.length - 1} onClick={() => setIdx(i => i + 1)}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
