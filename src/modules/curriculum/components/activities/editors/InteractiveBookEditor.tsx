import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import { MediaInsert } from "./MediaInsert";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import type { InteractiveBookContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: InteractiveBookContent; onChange: (c: InteractiveBookContent) => void; }

export function InteractiveBookEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Book Title</Label>
        <Input className="mt-1.5" value={content.title} onChange={e => onChange({ ...content, title: e.target.value })} />
      </div>
      <Label className="text-sm font-medium">Chapters</Label>
      {content.chapters.map((ch, i) => (
        <div key={ch.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ReorderControls index={i} total={content.chapters.length} label={`Ch. ${i + 1}`} onMove={(offset) => onChange({ ...content, chapters: moveItem(content.chapters, i, offset) })} />
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...content, chapters: content.chapters.filter(x => x.id !== ch.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input placeholder="Chapter title" value={ch.title} onChange={e => onChange({ ...content, chapters: content.chapters.map(x => x.id === ch.id ? { ...x, title: e.target.value } : x) })} />
          <RichTextEditor
            content={ch.content}
            onChange={html => onChange({ ...content, chapters: content.chapters.map(x => x.id === ch.id ? { ...x, content: html } : x) })}
            placeholder="Chapter content..."
          />
          <MediaInsert
            media={ch.media}
            onChange={media => onChange({ ...content, chapters: content.chapters.map(x => x.id === ch.id ? { ...x, media } : x) })}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...content, chapters: [...content.chapters, { id: crypto.randomUUID(), title: "", content: "" }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Chapter
      </Button>
    </div>
  );
}
