import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import { MediaInsert } from "./MediaInsert";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import type { ColumnContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: ColumnContent; onChange: (c: ColumnContent) => void; }

export function ColumnEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Sections</Label>
      {content.sections.map((s, i) => (
        <div key={s.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ReorderControls index={i} total={content.sections.length} label={`Section ${i + 1}`} onMove={(offset) => onChange({ sections: moveItem(content.sections, i, offset) })} />
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ sections: content.sections.filter(x => x.id !== s.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input placeholder="Section title" value={s.title} onChange={e => onChange({ sections: content.sections.map(x => x.id === s.id ? { ...x, title: e.target.value } : x) })} />
          <RichTextEditor
            content={s.content}
            onChange={html => onChange({ sections: content.sections.map(x => x.id === s.id ? { ...x, content: html } : x) })}
            placeholder="Content..."
            compact
          />
          <MediaInsert
            media={s.media}
            onChange={media => onChange({ sections: content.sections.map(x => x.id === s.id ? { ...x, media } : x) })}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ sections: [...content.sections, { id: crypto.randomUUID(), title: "", content: "" }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Section
      </Button>
    </div>
  );
}
