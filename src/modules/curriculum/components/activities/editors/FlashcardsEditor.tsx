import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import { MediaInsert } from "./MediaInsert";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import type { FlashcardsContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: FlashcardsContent; onChange: (c: FlashcardsContent) => void; }

export function FlashcardsEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Flashcards</Label>
      {content.cards.map((card, i) => (
        <div key={card.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ReorderControls index={i} total={content.cards.length} label={`Card ${i + 1}`} onMove={(offset) => onChange({ cards: moveItem(content.cards, i, offset) })} />
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ cards: content.cards.filter(c => c.id !== card.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input placeholder="Term" value={card.term} onChange={e => onChange({ cards: content.cards.map(c => c.id === card.id ? { ...c, term: e.target.value } : c) })} />
          <RichTextEditor
            content={card.definition}
            onChange={html => onChange({ cards: content.cards.map(c => c.id === card.id ? { ...c, definition: html } : c) })}
            placeholder="Definition"
            compact
          />
          <MediaInsert
            media={card.media}
            onChange={media => onChange({ cards: content.cards.map(c => c.id === card.id ? { ...c, media } : c) })}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ cards: [...content.cards, { id: crypto.randomUUID(), term: "", definition: "" }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Flashcard
      </Button>
    </div>
  );
}
