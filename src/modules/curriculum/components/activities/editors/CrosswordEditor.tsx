import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import type { CrosswordContent, CrosswordWord } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: CrosswordContent; onChange: (c: CrosswordContent) => void; }

export function CrosswordEditor({ content, onChange }: Props) {
  const updateWord = (id: string, patch: Partial<CrosswordWord>) =>
    onChange({ ...content, words: content.words.map(w => w.id === id ? { ...w, ...patch } : w) });

  return (
    <div className="space-y-4">
      <div>
        <Label>Crossword Title</Label>
        <Input className="mt-1.5" value={content.title} onChange={e => onChange({ ...content, title: e.target.value })} />
      </div>
      <Label className="text-sm font-medium">Words & Clues</Label>
      {content.words.map((w, i) => (
        <div key={w.id} className="flex items-center gap-2">
          <ReorderControls index={i} total={content.words.length} label={`${i + 1}.`} onMove={(offset) => onChange({ ...content, words: moveItem(content.words, i, offset) })} />
          <Input className="w-32 uppercase font-mono" placeholder="WORD" value={w.word} onChange={e => updateWord(w.id, { word: e.target.value.toUpperCase() })} />
          <Input className="flex-1" placeholder="Clue" value={w.clue} onChange={e => updateWord(w.id, { clue: e.target.value })} />
          <Select value={w.direction} onValueChange={v => updateWord(w.id, { direction: v as "across" | "down" })}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="across">Across</SelectItem>
              <SelectItem value="down">Down</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onChange({ ...content, words: content.words.filter(x => x.id !== w.id) })}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...content, words: [...content.words, { id: crypto.randomUUID(), word: "", clue: "", direction: "across" }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Word
      </Button>
    </div>
  );
}
