import { Badge } from "@/components/ui/badge";
import type { InteractiveVideoContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: InteractiveVideoContent; }

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function InteractiveVideoPlayer({ content }: Props) {
  if (!content.videoUrl) {
    return <p className="text-sm text-muted-foreground text-center py-8">No video URL configured.</p>;
  }

  // Simple embed for YouTube/Vimeo
  const embedUrl = content.videoUrl.includes("youtube.com/watch?v=")
    ? content.videoUrl.replace("watch?v=", "embed/")
    : content.videoUrl.includes("youtu.be/")
    ? `https://www.youtube.com/embed/${content.videoUrl.split("youtu.be/")[1]}`
    : content.videoUrl;

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden border border-border aspect-video">
        <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Video" />
      </div>
      {content.interactions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Interactions</p>
          <div className="space-y-1.5">
            {content.interactions.sort((a, b) => a.timestamp - b.timestamp).map(inter => (
              <div key={inter.id} className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="text-xs font-mono">{formatTime(inter.timestamp)}</Badge>
                <Badge variant="outline" className="text-xs">{inter.type}</Badge>
                <span className="text-muted-foreground">{inter.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
