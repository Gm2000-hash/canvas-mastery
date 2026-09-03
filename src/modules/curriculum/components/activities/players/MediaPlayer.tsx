import type { MediaEmbed } from "@/modules/curriculum/lib/h5p-types";

interface Props {
  media?: MediaEmbed;
  className?: string;
}

export function MediaPlayer({ media, className = "" }: Props) {
  if (!media?.url) return null;

  const youtubeId = media.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/)?.[1];
  const vimeoId = media.url.match(/vimeo\.com\/(\d+)/)?.[1];

  if (media.type === "video") {
    if (youtubeId) {
      return (
        <div className={`aspect-video rounded-lg overflow-hidden bg-black ${className}`}>
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
            allowFullScreen
          />
        </div>
      );
    }
    if (vimeoId) {
      return (
        <div className={`aspect-video rounded-lg overflow-hidden bg-black ${className}`}>
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}`}
            className="w-full h-full"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>
      );
    }
    return <video src={media.url} controls className={`w-full rounded-lg max-h-64 ${className}`} preload="metadata" />;
  }

  if (media.type === "audio") {
    return <audio src={media.url} controls className={`w-full ${className}`} preload="metadata" />;
  }

  if (media.type === "image") {
    return <img src={media.url} alt="Media" className={`w-full rounded-lg max-h-64 object-contain ${className}`} />;
  }

  return null;
}
