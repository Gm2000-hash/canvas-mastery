import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import type { MemoryGameContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: MemoryGameContent; onChange: (c: MemoryGameContent) => void; }

export function MemoryGameEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Card Pairs</Label>
      <p className="text-xs text-muted-foreground">Each pair has two matching cards. Students flip cards to find matches.</p>
      {content.pairs.map((pair, i) => (
        <div key={pair.id} className="flex items-center gap-2">
          <ReorderControls index={i} total={content.pairs.length} label={`${i + 1}.`} onMove={(offset) => onChange({ pairs: moveItem(content.pairs, i, offset) })} />
          <Input className="flex-1" placeholder="Card A" value={pair.cardA} onChange={e => onChange({ pairs: content.pairs.map(p => p.id === pair.id ? { ...p, cardA: e.target.value } : p) })} />
          <span className="text-xs text-muted-foreground">↔</span>
          <Input className="flex-1" placeholder="Card B (match)" value={pair.cardB} onChange={e => onChange({ pairs: content.pairs.map(p => p.id === pair.id ? { ...p, cardB: e.target.value } : p) })} />
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onChange({ pairs: content.pairs.filter(p => p.id !== pair.id) })}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ pairs: [...content.pairs, { id: crypto.randomUUID(), cardA: "", cardB: "" }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Pair
      </Button>
    </div>
  );
}
