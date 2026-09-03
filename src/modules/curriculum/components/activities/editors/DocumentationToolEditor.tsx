import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import type { DocumentationToolContent, DocField } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: DocumentationToolContent; onChange: (c: DocumentationToolContent) => void; }

export function DocumentationToolEditor({ content, onChange }: Props) {
  const updateField = (id: string, patch: Partial<DocField>) =>
    onChange({ ...content, fields: content.fields.map(f => f.id === id ? { ...f, ...patch } : f) });

  return (
    <div className="space-y-4">
      <div>
        <Label>Document Title</Label>
        <Input className="mt-1.5" value={content.title} onChange={e => onChange({ ...content, title: e.target.value })} />
      </div>
      <Label className="text-sm font-medium">Form Fields</Label>
      {content.fields.map((f, i) => (
        <div key={f.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Field {i + 1}</span>
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...content, fields: content.fields.filter(x => x.id !== f.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input placeholder="Label" value={f.label} onChange={e => updateField(f.id, { label: e.target.value })} />
          <div className="flex items-center gap-3">
            <Select value={f.type} onValueChange={v => updateField(f.id, { type: v as DocField["type"] })}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="textarea">Long Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Switch checked={f.required} onCheckedChange={v => updateField(f.id, { required: v })} />
              <span className="text-xs text-muted-foreground">Required</span>
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...content, fields: [...content.fields, { id: crypto.randomUUID(), label: "", type: "text", required: false }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Field
      </Button>
    </div>
  );
}
