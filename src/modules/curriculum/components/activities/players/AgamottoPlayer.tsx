import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import type { AgamottoContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: AgamottoContent; }

export function AgamottoPlayer({ content }: Props) {
  const [value, setValue] = useState([0]);
  
  if (content.images.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No images configured.</p>;
  }

  const max = Math.max(content.images.length - 1, 1);
  const idx = Math.round((value[0] / 100) * max);
  const img = content.images[idx];

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden border border-border bg-muted/20 min-h-[200px] flex items-center justify-center">
        {img?.imageUrl ? (
          <img src={img.imageUrl} alt={img.label} className="w-full max-h-[400px] object-contain" />
        ) : (
          <div className="text-center p-8">
            <p className="text-lg font-semibold">{img?.label}</p>
            {img?.description && <p className="text-sm text-muted-foreground mt-1">{img.description}</p>}
          </div>
        )}
      </div>
      <Slider value={value} onValueChange={setValue} max={100} step={1} className="w-full" />
      <div className="flex justify-between text-xs text-muted-foreground">
        {content.images.map((im, i) => (
          <span key={im.id} className={i === idx ? "text-primary font-medium" : ""}>{im.label}</span>
        ))}
      </div>
    </div>
  );
}
