import type { TimelineContent } from "@/modules/curriculum/lib/h5p-types";
import { RichContent } from "./RichContent";
import { MediaPlayer } from "./MediaPlayer";

interface Props {
  content: TimelineContent;
}

export function TimelinePlayer({ content }: Props) {
  return (
    <div className="space-y-4">
      {content.headline && (
        <h3 className="text-lg font-semibold text-foreground">{content.headline}</h3>
      )}
      <div className="relative pl-6 border-l-2 border-primary/20 space-y-6">
        {content.events.map((evt) => (
          <div key={evt.id} className="relative">
            <div className="absolute -left-[calc(1.5rem+5px)] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{evt.date}</span>
                <h4 className="text-sm font-semibold text-foreground">{evt.title}</h4>
              </div>
              <RichContent html={evt.description} />
              {evt.imageUrl && (
                <img src={evt.imageUrl} alt={evt.title} className="rounded-lg max-h-40 mt-2" />
              )}
              <MediaPlayer media={evt.media} className="mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
