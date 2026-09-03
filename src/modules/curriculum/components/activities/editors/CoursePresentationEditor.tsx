import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import { MediaInsert } from "./MediaInsert";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import type { CoursePresentationContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: CoursePresentationContent; onChange: (c: CoursePresentationContent) => void; }

export function CoursePresentationEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Slides</Label>
      {content.slides.map((s, i) => (
        <div key={s.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ReorderControls index={i} total={content.slides.length} label={`Slide ${i + 1}`} onMove={(offset) => onChange({ slides: moveItem(content.slides, i, offset) })} />
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ slides: content.slides.filter(x => x.id !== s.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input placeholder="Slide title" value={s.title} onChange={e => onChange({ slides: content.slides.map(x => x.id === s.id ? { ...x, title: e.target.value } : x) })} />
          <RichTextEditor
            content={s.content}
            onChange={html => onChange({ slides: content.slides.map(x => x.id === s.id ? { ...x, content: html } : x) })}
            placeholder="Slide content..."
          />
          <MediaInsert
            media={s.media}
            onChange={media => onChange({ slides: content.slides.map(x => x.id === s.id ? { ...x, media } : x) })}
          />
          <Input placeholder="Speaker notes (optional)" value={s.notes ?? ""} onChange={e => onChange({ slides: content.slides.map(x => x.id === s.id ? { ...x, notes: e.target.value } : x) })} />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ slides: [...content.slides, { id: crypto.randomUUID(), title: "", content: "", notes: "" }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Slide
      </Button>
    </div>
  );
}
