import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import type { DragAndDropContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: DragAndDropContent; onChange: (c: DragAndDropContent) => void; }

export function DragAndDropEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-6">
      {/* Items */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Draggable Items</Label>
        {content.items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <ReorderControls index={i} total={content.items.length} label="" onMove={(offset) => onChange({ ...content, items: moveItem(content.items, i, offset) })} />
            <Input className="flex-1" value={item.label} placeholder={`Item ${i + 1}`} onChange={e => onChange({ ...content, items: content.items.map(x => x.id === item.id ? { ...x, label: e.target.value } : x) })} />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onChange({ ...content, items: content.items.filter(x => x.id !== item.id), zones: content.zones.map(z => ({ ...z, correctItemIds: z.correctItemIds.filter(id => id !== item.id) })) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange({ ...content, items: [...content.items, { id: crypto.randomUUID(), label: "" }] })}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Item
        </Button>
      </div>

      {/* Zones */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Drop Zones</Label>
        {content.zones.map((zone, zi) => (
          <div key={zone.id} className="border border-border/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ReorderControls index={zi} total={content.zones.length} label={`Zone ${zi + 1}`} onMove={(offset) => onChange({ ...content, zones: moveItem(content.zones, zi, offset) })} />
              <div className="flex-1" />
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onChange({ ...content, zones: content.zones.filter(z => z.id !== zone.id) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input value={zone.label} placeholder="Zone label" onChange={e => onChange({ ...content, zones: content.zones.map(z => z.id === zone.id ? { ...z, label: e.target.value } : z) })} />
            <p className="text-xs text-muted-foreground">Correct items for this zone:</p>
            <div className="flex flex-wrap gap-3">
              {content.items.map(item => (
                <label key={item.id} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={zone.correctItemIds.includes(item.id)}
                    onCheckedChange={v => {
                      const ids = v ? [...zone.correctItemIds, item.id] : zone.correctItemIds.filter(id => id !== item.id);
                      onChange({ ...content, zones: content.zones.map(z => z.id === zone.id ? { ...z, correctItemIds: ids } : z) });
                    }}
                  />
                  {item.label || "(unnamed)"}
                </label>
              ))}
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange({ ...content, zones: [...content.zones, { id: crypto.randomUUID(), label: "", correctItemIds: [] }] })}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Zone
        </Button>
      </div>
    </div>
  );
}
