import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import type { EssayContent, EssayKeyword } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: EssayContent; onChange: (c: EssayContent) => void; }

export function EssayEditor({ content, onChange }: Props) {
  const updateKw = (idx: number, patch: Partial<EssayKeyword>) =>
    onChange({ ...content, keywords: content.keywords.map((k, i) => i === idx ? { ...k, ...patch } : k) });

  return (
    <div className="space-y-4">
      <div>
        <Label>Question / Prompt</Label>
        <div className="mt-1.5">
          <RichTextEditor
            content={content.question}
            onChange={html => onChange({ ...content, question: html })}
            placeholder="Enter your essay prompt..."
          />
        </div>
      </div>
      <div>
        <Label>Max Words</Label>
        <Input type="number" className="mt-1.5 w-32" value={content.maxWords ?? 200} onChange={e => onChange({ ...content, maxWords: parseInt(e.target.value) || 200 })} />
      </div>
      <Label className="text-sm font-medium">Keywords for Feedback</Label>
      {content.keywords.map((kw, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="flex-1" value={kw.text} onChange={e => updateKw(i, { text: e.target.value })} placeholder="Keyword" />
          <div className="flex items-center gap-1.5">
            <Switch checked={kw.caseSensitive} onCheckedChange={v => updateKw(i, { caseSensitive: v })} />
            <span className="text-xs text-muted-foreground">Aa</span>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onChange({ ...content, keywords: content.keywords.filter((_, j) => j !== i) })}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...content, keywords: [...content.keywords, { text: "", caseSensitive: false }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Keyword
      </Button>
    </div>
  );
}
