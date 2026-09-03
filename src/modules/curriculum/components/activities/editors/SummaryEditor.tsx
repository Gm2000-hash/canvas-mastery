import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import type { SummaryContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: SummaryContent; onChange: (c: SummaryContent) => void; }

export function SummaryEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Introduction Text</Label>
        <Input className="mt-1.5" value={content.intro} onChange={e => onChange({ ...content, intro: e.target.value })} />
      </div>
      <Label className="text-sm font-medium">Statement Groups</Label>
      {content.groups.map((g, gi) => (
        <div key={g.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ReorderControls index={gi} total={content.groups.length} label={`Group ${gi + 1}`} onMove={(offset) => onChange({ ...content, groups: moveItem(content.groups, gi, offset) })} />
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...content, groups: content.groups.filter(x => x.id !== g.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <RadioGroup value={String(g.correctIndex)} onValueChange={v => {
            onChange({ ...content, groups: content.groups.map(x => x.id === g.id ? { ...x, correctIndex: parseInt(v) } : x) });
          }}>
            {g.statements.map((s, si) => (
              <div key={si} className="flex items-center gap-2">
                <RadioGroupItem value={String(si)} id={`${g.id}-${si}`} />
                <Input className="flex-1" value={s} onChange={e => {
                  const stmts = [...g.statements]; stmts[si] = e.target.value;
                  onChange({ ...content, groups: content.groups.map(x => x.id === g.id ? { ...x, statements: stmts } : x) });
                }} placeholder={`Statement ${si + 1}`} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                  const stmts = g.statements.filter((_, i) => i !== si);
                  onChange({ ...content, groups: content.groups.map(x => x.id === g.id ? { ...x, statements: stmts, correctIndex: g.correctIndex >= si ? Math.max(0, g.correctIndex - 1) : g.correctIndex } : x) });
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </RadioGroup>
          <Button variant="ghost" size="sm" onClick={() => {
            const stmts = [...g.statements, ""];
            onChange({ ...content, groups: content.groups.map(x => x.id === g.id ? { ...x, statements: stmts } : x) });
          }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Statement
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...content, groups: [...content.groups, { id: crypto.randomUUID(), statements: ["", ""], correctIndex: 0 }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Group
      </Button>
    </div>
  );
}
