import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichContent } from "./RichContent";
import { MediaPlayer } from "./MediaPlayer";
import type { ImageHotspotsContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: ImageHotspotsContent; }

export function ImageHotspotsPlayer({ content }: Props) {
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const active = content.hotspots.find(h => h.id === activeHotspot);

  if (!content.imageUrl) {
    return <p className="text-sm text-muted-foreground text-center py-8">No image configured.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden border border-border">
        <img src={content.imageUrl} alt="Hotspot image" className="w-full" />
        {content.hotspots.map(h => (
          <button
            key={h.id}
            onClick={() => setActiveHotspot(h.id)}
            className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-primary/80 border-2 border-background text-primary-foreground text-xs font-bold flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            title={h.title}
          >
            +
          </button>
        ))}
      </div>
      <Dialog open={!!activeHotspot} onOpenChange={() => setActiveHotspot(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{active?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <RichContent html={active?.content || ""} />
            <MediaPlayer media={active?.media} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
