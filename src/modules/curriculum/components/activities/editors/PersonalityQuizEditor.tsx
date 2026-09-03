import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import type { PersonalityQuizContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: PersonalityQuizContent; onChange: (c: PersonalityQuizContent) => void; }

export function PersonalityQuizEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-6">
      {/* Profiles */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Personality Profiles</Label>
        {content.profiles.map((p, i) => (
          <div key={p.id} className="border border-border/60 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ReorderControls index={i} total={content.profiles.length} label={`Profile ${i + 1}`} onMove={(offset) => onChange({ ...content, profiles: moveItem(content.profiles, i, offset) })} />
              <div className="flex-1" />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...content, profiles: content.profiles.filter(x => x.id !== p.id) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input placeholder="Profile name" value={p.name} onChange={e => onChange({ ...content, profiles: content.profiles.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) })} />
            <Textarea placeholder="Description" className="min-h-[50px] text-sm" value={p.description} onChange={e => onChange({ ...content, profiles: content.profiles.map(x => x.id === p.id ? { ...x, description: e.target.value } : x) })} />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange({ ...content, profiles: [...content.profiles, { id: crypto.randomUUID(), name: "", description: "" }] })}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Profile
        </Button>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Questions</Label>
        {content.questions.map((q, qi) => (
          <div key={q.id} className="border border-border/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ReorderControls index={qi} total={content.questions.length} label={`Q${qi + 1}`} onMove={(offset) => onChange({ ...content, questions: moveItem(content.questions, qi, offset) })} />
              <div className="flex-1" />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...content, questions: content.questions.filter(x => x.id !== q.id) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input placeholder="Question" value={q.question} onChange={e => onChange({ ...content, questions: content.questions.map(x => x.id === q.id ? { ...x, question: e.target.value } : x) })} />
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2 pl-4">
                <Input className="flex-1" placeholder={`Option ${oi + 1}`} value={opt.text} onChange={e => {
                  const opts = [...q.options]; opts[oi] = { ...opts[oi], text: e.target.value };
                  onChange({ ...content, questions: content.questions.map(x => x.id === q.id ? { ...x, options: opts } : x) });
                }} />
                {content.profiles.map(p => (
                  <Input key={p.id} type="number" className="w-16" title={`Score for ${p.name}`} placeholder={p.name.slice(0, 3)}
                    value={opt.profileScores[p.id] ?? 0}
                    onChange={e => {
                      const opts = [...q.options]; opts[oi] = { ...opts[oi], profileScores: { ...opts[oi].profileScores, [p.id]: parseInt(e.target.value) || 0 } };
                      onChange({ ...content, questions: content.questions.map(x => x.id === q.id ? { ...x, options: opts } : x) });
                    }}
                  />
                ))}
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                  const opts = q.options.filter((_, i) => i !== oi);
                  onChange({ ...content, questions: content.questions.map(x => x.id === q.id ? { ...x, options: opts } : x) });
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => {
              const scores: Record<string, number> = {};
              content.profiles.forEach(p => scores[p.id] = 0);
              const opts = [...q.options, { text: "", profileScores: scores }];
              onChange({ ...content, questions: content.questions.map(x => x.id === q.id ? { ...x, options: opts } : x) });
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...content, questions: [...content.questions, { id: crypto.randomUUID(), question: "", options: [] }] })}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Question
        </Button>
      </div>
    </div>
  );
}
