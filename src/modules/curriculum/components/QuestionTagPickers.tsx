import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Sparkles, Loader2 } from "lucide-react";
import { ALL_SUBSTANDARDS, DOK_LEVELS, BLOOMS_LEVELS } from "@/modules/curriculum/lib/ngss-data";
import { ALL_IDAHO_STANDARDS_FLAT, IDAHO_CATEGORY_LABELS } from "@/modules/curriculum/lib/idaho-standards-data";
import { tagQuestionsWithStandards } from "@/modules/curriculum/lib/standards-api";
import { toast } from "sonner";

// Combined standards list for searching
const ALL_COMBINED_STANDARDS = [
  ...Object.values(ALL_SUBSTANDARDS).flat().map(s => ({ ...s, framework: "NGSS" as const })),
  ...ALL_IDAHO_STANDARDS_FLAT.map(s => ({ code: s.code, description: s.description, framework: "Idaho" as const, category: s.category })),
];

// ─── Standards Picker (supports both NGSS and Idaho) ───

interface StandardsPickerProps {
  standards: { ngss_code: string; ngss_description: string }[];
  onChange: (standards: { ngss_code: string; ngss_description: string }[]) => void;
  questionText?: string;
}

export function StandardsPicker({ standards, onChange, questionText }: StandardsPickerProps) {
  const [search, setSearch] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  const removeStandard = (index: number) => {
    onChange(standards.filter((_, i) => i !== index));
  };

  const addStandard = (code: string, description: string) => {
    if (!standards.some(s => s.ngss_code === code)) {
      onChange([...standards, { ngss_code: code, ngss_description: description }]);
    }
    setSearch("");
  };

  const handleAutoSuggest = async () => {
    if (!questionText?.trim()) {
      toast.error("Enter question text first to get AI suggestions");
      return;
    }
    setSuggesting(true);
    try {
      const result = await tagQuestionsWithStandards([{ id: 1, question_text: questionText }], "ngss");
      const suggested = result.get(1) || [];
      if (suggested.length === 0) {
        toast.info("No NGSS standards matched this question");
        return;
      }
      const newStandards = [...standards];
      let added = 0;
      for (const s of suggested) {
        if (!newStandards.some(ex => ex.ngss_code === s.code)) {
          newStandards.push({ ngss_code: s.code, ngss_description: s.description });
          added++;
        }
      }
      onChange(newStandards);
      toast.success(`Added ${added} standard${added !== 1 ? 's' : ''} (${suggested.length} suggested)`);
    } catch (e: any) {
      toast.error(e.message || "Failed to suggest standards");
    } finally {
      setSuggesting(false);
    }
  };

  const filteredStandards = search.trim()
    ? ALL_COMBINED_STANDARDS
        .filter(sub => {
          const q = search.toLowerCase();
          return (
            (sub.code.toLowerCase().includes(q) || sub.description.toLowerCase().includes(q)) &&
            !standards.some(s => s.ngss_code === sub.code)
          );
        })
        .slice(0, 25)
    : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Standards</Label>
        {questionText !== undefined && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoSuggest}
            disabled={suggesting || !questionText?.trim()}
            className="gap-1.5 h-7 text-xs"
          >
            {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            AI Suggest
          </Button>
        )}
      </div>
      {standards.length > 0 && (
        <div className="space-y-1.5">
          {standards.map((s, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-muted/50 rounded-md px-3 py-2 min-w-0">
              <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">{s.ngss_code}</Badge>
              <span className="text-xs text-muted-foreground flex-1 break-words">{s.ngss_description}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => removeStandard(idx)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search standards (NGSS or Idaho, e.g. MS-ESS2-3 or RC.7.3)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 text-sm h-9"
        />
      </div>
      {search.trim() && (
        <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
          {filteredStandards.length > 0 ? (
            filteredStandards.map((sub, idx) => (
              <button
                key={`${sub.code}-${idx}`}
                type="button"
                className="w-full flex items-start gap-2 px-3 py-2 hover:bg-muted/50 text-left transition-colors"
                onClick={() => addStandard(sub.code, sub.description)}
              >
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  <Badge variant="outline" className="text-xs">{sub.code}</Badge>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">{sub.framework}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{sub.description}</span>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground p-3">No matching standards found</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DOK & Bloom's Picker ───

interface CognitiveLevelPickerProps {
  dokLevel: number | null;
  bloomsLevel: string | null;
  onDokChange: (dok: number | null) => void;
  onBloomsChange: (blooms: string | null) => void;
  compact?: boolean;
}

export function CognitiveLevelPicker({ dokLevel, bloomsLevel, onDokChange, onBloomsChange, compact }: CognitiveLevelPickerProps) {
  return (
    <div className={compact ? "flex gap-3" : "grid grid-cols-2 gap-3"}>
      <div className="space-y-1.5">
        <Label className="text-xs">DOK Level</Label>
        <Select value={dokLevel != null ? String(dokLevel) : "auto"} onValueChange={v => onDokChange(v === "auto" ? null : Number(v))}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Auto-detect" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            {DOK_LEVELS.map(d => (
              <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Bloom's Level</Label>
        <Select value={bloomsLevel || "auto"} onValueChange={v => onBloomsChange(v === "auto" ? null : v)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Auto-detect" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            {BLOOMS_LEVELS.map(b => (
              <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
