import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { RichContent } from "./RichContent";
import type { EssayContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: EssayContent; }

export function EssayPlayer({ content }: Props) {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const results = checked
    ? content.keywords.map(kw => {
        const t = kw.caseSensitive ? text : text.toLowerCase();
        const k = kw.caseSensitive ? kw.text : kw.text.toLowerCase();
        return { keyword: kw.text, found: t.includes(k) };
      })
    : null;

  const found = results ? results.filter(r => r.found).length : 0;

  return (
    <div className="space-y-4">
      <RichContent html={content.question} className="font-medium" />
      <Textarea
        value={text}
        onChange={e => { setText(e.target.value); setChecked(false); }}
        className="min-h-[150px]"
        disabled={checked}
        placeholder="Write your answer here..."
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${content.maxWords && wordCount > content.maxWords ? "text-destructive" : "text-muted-foreground"}`}>
          {wordCount}{content.maxWords ? `/${content.maxWords}` : ""} words
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => setChecked(true)} disabled={checked || !text.trim()}>Check Keywords</Button>
        {checked && (
          <Button variant="outline" onClick={() => { setText(""); setChecked(false); }}>Reset</Button>
        )}
      </div>
      {results && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{found}/{results.length} keywords found</p>
          <div className="flex flex-wrap gap-2">
            {results.map((r, i) => (
              <Badge key={i} variant={r.found ? "default" : "secondary"} className={r.found ? "bg-green-100 text-green-700 border-green-200" : ""}>
                {r.found ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                {r.keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
