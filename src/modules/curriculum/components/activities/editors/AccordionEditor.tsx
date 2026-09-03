import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import { MediaInsert } from "./MediaInsert";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import type { AccordionContent, AccordionPanel } from "@/modules/curriculum/lib/h5p-types";

interface Props {
  content: AccordionContent;
  onChange: (c: AccordionContent) => void;
}

export function AccordionEditor({ content, onChange }: Props) {
  const updatePanel = (id: string, patch: Partial<AccordionPanel>) => {
    onChange({ panels: content.panels.map(p => p.id === id ? { ...p, ...patch } : p) });
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Accordion Panels</Label>
      {content.panels.map((panel, idx) => (
        <div key={panel.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ReorderControls index={idx} total={content.panels.length} label={`Panel ${idx + 1}`} onMove={(offset) => onChange({ panels: moveItem(content.panels, idx, offset) })} />
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ panels: content.panels.filter(p => p.id !== panel.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            placeholder="Panel title"
            value={panel.title}
            onChange={e => updatePanel(panel.id, { title: e.target.value })}
          />
          <RichTextEditor
            content={panel.content}
            onChange={html => updatePanel(panel.id, { content: html })}
            placeholder="Panel content..."
            compact
          />
          <MediaInsert
            media={panel.media}
            onChange={media => updatePanel(panel.id, { media })}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ panels: [...content.panels, { id: crypto.randomUUID(), title: "", content: "" }] })} className="w-full">
        <Plus className="h-4 w-4 mr-1.5" /> Add Panel
      </Button>
    </div>
  );
}
