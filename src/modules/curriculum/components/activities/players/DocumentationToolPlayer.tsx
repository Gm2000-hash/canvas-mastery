import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import type { DocumentationToolContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: DocumentationToolContent; }

export function DocumentationToolPlayer({ content }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const update = (id: string, val: string) => setValues(prev => ({ ...prev, [id]: val }));

  const allFilled = content.fields.filter(f => f.required).every(f => (values[f.id] ?? "").trim());

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <FileText className="h-5 w-5" />
          <h3 className="font-semibold">{content.title}</h3>
        </div>
        <div className="rounded-xl border border-border p-4 space-y-3">
          {content.fields.map(f => (
            <div key={f.id}>
              <p className="text-xs font-semibold text-muted-foreground uppercase">{f.label}</p>
              <p className="text-sm mt-0.5">{values[f.id] || "—"}</p>
            </div>
          ))}
        </div>
        <Button variant="outline" onClick={() => setSubmitted(false)}>Edit</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{content.title}</h3>
      {content.fields.map(f => (
        <div key={f.id}>
          <label className="text-sm font-medium">{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</label>
          {f.type === "textarea" ? (
            <Textarea className="mt-1 text-sm" value={values[f.id] ?? ""} onChange={e => update(f.id, e.target.value)} />
          ) : (
            <Input type={f.type === "number" ? "number" : "text"} className="mt-1" value={values[f.id] ?? ""} onChange={e => update(f.id, e.target.value)} />
          )}
        </div>
      ))}
      <Button onClick={() => setSubmitted(true)} disabled={!allFilled}>Generate Document</Button>
    </div>
  );
}
