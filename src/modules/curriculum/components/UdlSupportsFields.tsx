import { useState, ReactNode, KeyboardEvent } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface UdlPrincipleSectionProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  tone: string; // tailwind classes for bg + border (intentional inline color tints per principle)
  children: ReactNode;
}

export function UdlPrincipleSection({ icon, title, subtitle, tone, children }: UdlPrincipleSectionProps) {
  return (
    <div className={`rounded-xl border ${tone} p-3 space-y-3`}>
      <div className="flex items-baseline gap-2">
        <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          {icon}
          <span>{title}</span>
        </div>
        <span className="text-xs italic text-muted-foreground">{subtitle}</span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

interface UdlFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

export function UdlField({ label, value, onChange, placeholder, rows = 2 }: UdlFieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground/80">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="text-sm bg-white/70"
      />
    </div>
  );
}

interface UdlChipsProps {
  label: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (idx: number) => void;
  placeholder?: string;
  tone?: "amber" | "green" | "blue";
}

export function UdlChips({ label, items, onAdd, onRemove, placeholder, tone = "amber" }: UdlChipsProps) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const chipClass =
    tone === "green"
      ? "bg-green-200 text-green-900 border-green-300"
      : tone === "blue"
      ? "bg-blue-200 text-blue-900 border-blue-300"
      : "bg-amber-200 text-amber-900 border-amber-300";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground/80">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No options yet — add at least 2.</span>
        )}
        {items.map((item, idx) => (
          <span
            key={idx}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${chipClass}`}
          >
            <span className="max-w-[20rem] whitespace-normal">{item}</span>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="opacity-60 hover:opacity-100"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="text-sm h-8 bg-white/70"
        />
        <Button size="sm" variant="outline" className="h-8 rounded-lg gap-1" onClick={submit}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
