import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import type { MultipleChoiceContent, MCOption } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: MultipleChoiceContent; onChange: (c: MultipleChoiceContent) => void; }

export function MultipleChoiceEditor({ content, onChange }: Props) {
  const updateOption = (id: string, patch: Partial<MCOption>) =>
    onChange({ ...content, options: content.options.map(o => o.id === id ? { ...o, ...patch } : o) });

  return (
    <div className="space-y-4">
      <div>
        <Label>Question</Label>
        <div className="mt-1.5">
          <RichTextEditor
            content={content.question}
            onChange={html => onChange({ ...content, question: html })}
            placeholder="Enter your question..."
            compact
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={content.multiAnswer} onCheckedChange={v => onChange({ ...content, multiAnswer: v })} />
        <Label className="text-sm">Allow multiple correct answers</Label>
      </div>
      <Label>Answer Options</Label>
      {content.options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-2">
          <ReorderControls index={i} total={content.options.length} label="" onMove={(offset) => onChange({ ...content, options: moveItem(content.options, i, offset) })} />
          <Checkbox checked={opt.correct} onCheckedChange={v => updateOption(opt.id, { correct: !!v })} />
          <Input className="flex-1" value={opt.text} onChange={e => updateOption(opt.id, { text: e.target.value })} placeholder={`Option ${i + 1}`} />
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onChange({ ...content, options: content.options.filter(o => o.id !== opt.id) })}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...content, options: [...content.options, { id: crypto.randomUUID(), text: "", correct: false }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Option
      </Button>
    </div>
  );
}
