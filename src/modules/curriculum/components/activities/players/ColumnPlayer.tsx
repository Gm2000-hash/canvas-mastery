import type { ColumnContent } from "@/modules/curriculum/lib/h5p-types";
import { RichContent } from "./RichContent";
import { MediaPlayer } from "./MediaPlayer";

interface Props { content: ColumnContent; }

export function ColumnPlayer({ content }: Props) {
  return (
    <div className="space-y-6">
      {content.sections.map((s) => (
        <div key={s.id} className="space-y-2">
          {s.title && <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>}
          <RichContent html={s.content} />
          <MediaPlayer media={s.media} />
        </div>
      ))}
    </div>
  );
}
