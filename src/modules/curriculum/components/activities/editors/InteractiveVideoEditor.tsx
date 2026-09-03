import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { InteractiveVideoContent, VideoInteraction } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: InteractiveVideoContent; onChange: (c: InteractiveVideoContent) => void; }

export function InteractiveVideoEditor({ content, onChange }: Props) {
  const updateInteraction = (id: string, patch: Partial<VideoInteraction>) =>
    onChange({ ...content, interactions: content.interactions.map(x => x.id === id ? { ...x, ...patch } : x) });

  return (
    <div className="space-y-4">
      <div>
        <Label>Video URL (YouTube, Vimeo, etc.)</Label>
        <Input className="mt-1.5" value={content.videoUrl} onChange={e => onChange({ ...content, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
      </div>
      <Label className="text-sm font-medium">Interactions</Label>
      {content.interactions.map((inter, i) => (
        <div key={inter.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">#{i + 1}</span>
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...content, interactions: content.interactions.filter(x => x.id !== inter.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input type="number" className="w-24" placeholder="Time (s)" value={inter.timestamp} onChange={e => updateInteraction(inter.id, { timestamp: parseFloat(e.target.value) || 0 })} />
            <Select value={inter.type} onValueChange={v => updateInteraction(inter.id, { type: v as VideoInteraction["type"] })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="label">Label</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="link">Link</SelectItem>
              </SelectContent>
            </Select>
            <Input className="flex-1" placeholder="Content" value={inter.content} onChange={e => updateInteraction(inter.id, { content: e.target.value })} />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...content, interactions: [...content.interactions, { id: crypto.randomUUID(), timestamp: 0, type: "label", content: "" }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Interaction
      </Button>
    </div>
  );
}
