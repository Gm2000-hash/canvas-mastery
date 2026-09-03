import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import { MediaInsert } from "./MediaInsert";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import type { TimelineContent, TimelineEvent } from "@/modules/curriculum/lib/h5p-types";

interface Props {
  content: TimelineContent;
  onChange: (c: TimelineContent) => void;
}

export function TimelineEditor({ content, onChange }: Props) {
  const updateEvent = (id: string, patch: Partial<TimelineEvent>) => {
    onChange({ ...content, events: content.events.map(e => e.id === id ? { ...e, ...patch } : e) });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Timeline Headline</Label>
        <Input
          className="mt-1.5"
          value={content.headline}
          onChange={e => onChange({ ...content, headline: e.target.value })}
          placeholder="My Timeline"
        />
      </div>
      <Label className="text-sm font-medium">Events</Label>
      {content.events.map((evt, idx) => (
        <div key={evt.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ReorderControls index={idx} total={content.events.length} label={`Event ${idx + 1}`} onMove={(offset) => onChange({ ...content, events: moveItem(content.events, idx, offset) })} />
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...content, events: content.events.filter(e => e.id !== evt.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Date (e.g. 1776)" value={evt.date} onChange={e => updateEvent(evt.id, { date: e.target.value })} />
            <Input placeholder="Title" value={evt.title} onChange={e => updateEvent(evt.id, { title: e.target.value })} />
          </div>
          <RichTextEditor
            content={evt.description}
            onChange={html => updateEvent(evt.id, { description: html })}
            placeholder="Description..."
            compact
          />
          <MediaInsert
            media={evt.media}
            onChange={media => updateEvent(evt.id, { media })}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...content, events: [...content.events, { id: crypto.randomUUID(), date: "", title: "", description: "" }] })} className="w-full">
        <Plus className="h-4 w-4 mr-1.5" /> Add Event
      </Button>
    </div>
  );
}
