import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import { MediaInsert } from "./MediaInsert";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import type { VirtualTourContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: VirtualTourContent; onChange: (c: VirtualTourContent) => void; }

export function VirtualTourEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Tour Title</Label>
        <Input className="mt-1.5" value={content.title} onChange={e => onChange({ ...content, title: e.target.value })} />
      </div>
      <Label className="text-sm font-medium">Scenes</Label>
      {content.scenes.map((s, i) => (
        <div key={s.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ReorderControls index={i} total={content.scenes.length} label={`Scene ${i + 1}`} onMove={(offset) => onChange({ ...content, scenes: moveItem(content.scenes, i, offset) })} />
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...content, scenes: content.scenes.filter(x => x.id !== s.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input placeholder="Scene title" value={s.title} onChange={e => onChange({ ...content, scenes: content.scenes.map(x => x.id === s.id ? { ...x, title: e.target.value } : x) })} />
          <RichTextEditor
            content={s.description}
            onChange={html => onChange({ ...content, scenes: content.scenes.map(x => x.id === s.id ? { ...x, description: html } : x) })}
            placeholder="Description..."
            compact
          />
          <Input placeholder="360° image URL (optional)" value={s.imageUrl ?? ""} onChange={e => onChange({ ...content, scenes: content.scenes.map(x => x.id === s.id ? { ...x, imageUrl: e.target.value } : x) })} />
          <MediaInsert
            media={s.media}
            onChange={media => onChange({ ...content, scenes: content.scenes.map(x => x.id === s.id ? { ...x, media } : x) })}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...content, scenes: [...content.scenes, { id: crypto.randomUUID(), title: "", description: "" }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Scene
      </Button>
    </div>
  );
}
