import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import type { SingleChoiceSetContent, SCQuestion } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: SingleChoiceSetContent; onChange: (c: SingleChoiceSetContent) => void; }

export function SingleChoiceSetEditor({ content, onChange }: Props) {
  const updateQ = (id: string, patch: Partial<SCQuestion>) =>
    onChange({ questions: content.questions.map(q => q.id === id ? { ...q, ...patch } : q) });

  const addOption = (qId: string) => {
    const q = content.questions.find(q => q.id === qId);
    if (q) updateQ(qId, { options: [...q.options, ""] });
  };

  return (
    <div className="space-y-5">
      <Label className="text-sm font-medium">Questions</Label>
      {content.questions.map((q, qi) => (
        <div key={q.id} className="border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ReorderControls index={qi} total={content.questions.length} label={`Q${qi + 1}`} onMove={(offset) => onChange({ questions: moveItem(content.questions, qi, offset) })} />
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ questions: content.questions.filter(x => x.id !== q.id) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input value={q.question} onChange={e => updateQ(q.id, { question: e.target.value })} placeholder="Question text" />
          <RadioGroup value={String(q.correctIndex)} onValueChange={v => updateQ(q.id, { correctIndex: parseInt(v) })}>
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <RadioGroupItem value={String(oi)} id={`${q.id}-${oi}`} />
                <Input
                  className="flex-1"
                  value={opt}
                  onChange={e => {
                    const opts = [...q.options]; opts[oi] = e.target.value;
                    updateQ(q.id, { options: opts });
                  }}
                  placeholder={`Option ${oi + 1}`}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                  const opts = q.options.filter((_, i) => i !== oi);
                  updateQ(q.id, { options: opts, correctIndex: q.correctIndex >= oi ? Math.max(0, q.correctIndex - 1) : q.correctIndex });
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </RadioGroup>
          <Button variant="ghost" size="sm" onClick={() => addOption(q.id)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ questions: [...content.questions, { id: crypto.randomUUID(), question: "", options: ["", ""], correctIndex: 0 }] })}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Question
      </Button>
    </div>
  );
}
