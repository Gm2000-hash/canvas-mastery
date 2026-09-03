import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_SUBSTANDARDS, getAllStandardsFlat } from "@/modules/curriculum/lib/ngss-data";
import { ALL_IDAHO_STANDARDS, ALL_IDAHO_STANDARDS_FLAT, IDAHO_CATEGORY_LABELS } from "@/modules/curriculum/lib/idaho-standards-data";
import { useProfileDefaults } from "@/modules/curriculum/hooks/useProfileDefaults";
import type { ActivityStandard } from "@/modules/curriculum/hooks/useActivityStandards";
import { Plus, X, Search, Tag, Loader2, Sparkles } from "lucide-react";

interface ActivityStandardsPickerProps {
  standards: ActivityStandard[];
  onAdd: (code: string, description: string) => Promise<void>;
  onRemove: (standardId: string) => Promise<void>;
  onAutoTag: () => void;
  tagging: boolean;
}

export function ActivityStandardsPicker({ standards, onAdd, onRemove, onAutoTag, tagging }: ActivityStandardsPickerProps) {
  const { defaultFramework, subjects } = useProfileDefaults();
  const teachesScience = subjects.includes("Science");
  const idahoSubjectsTaught = subjects.filter(s => s !== "Science");
  const restrictIdaho = idahoSubjectsTaught.length > 0;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [framework, setFramework] = useState<"ngss" | "idaho">(teachesScience ? defaultFramework : "idaho");
  const [idahoFilter, setIdahoFilter] = useState<string>("all");

  const existingCodes = new Set(standards.map(s => s.ngss_code));

  const ngssFlat = useMemo(() => getAllStandardsFlat(), []);

  const filtered = useMemo(() => {
    let list: { code: string; description: string; keyTerms?: string[]; category?: string; subject?: string; grade?: string }[];

    if (framework === "ngss") {
      list = ngssFlat as any[];
    } else {
      let stds = [...ALL_IDAHO_STANDARDS_FLAT] as any[];
      if (restrictIdaho) {
        stds = stds.filter((s: any) => idahoSubjectsTaught.includes(s.subject));
      }
      if (idahoFilter !== "all") {
        const [subject, grade] = idahoFilter.split("|");
        stds = stds.filter((s: any) => s.subject === subject && s.grade === grade);
      }
      list = stds;
    }

    list = list.filter(s => !existingCodes.has(s.code));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.code.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.keyTerms || []).some((t: string) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [search, framework, idahoFilter, ngssFlat, existingCodes]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach(s => {
      const group = framework === "ngss"
        ? s.code.replace(/-\d+$/, "")
        : (s as any).subject ? `${(s as any).subject} ${(s as any).grade}` : s.code.replace(/\.\d+$/, "");
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(s);
    });
    return Array.from(map.entries());
  }, [filtered, framework]);

  const handleAdd = async (code: string, description: string) => {
    setAdding(code);
    await onAdd(code, description);
    setAdding(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" /> Standards
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onAutoTag}
            disabled={tagging}
          >
            {tagging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Auto-tag
          </Button>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Add Standard
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              {/* Framework toggle */}
              <div className="p-2 border-b border-border space-y-2">
                {teachesScience && (
                  <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50 border border-border">
                    <button
                      onClick={() => setFramework("idaho")}
                      className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        framework === "idaho"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Idaho
                    </button>
                    <button
                      onClick={() => setFramework("ngss")}
                      className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        framework === "ngss"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      NGSS
                    </button>
                  </div>
                )}
                {framework === "idaho" && (
                  <Select value={idahoFilter} onValueChange={setIdahoFilter}>
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue placeholder="All subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subjects & Grades</SelectItem>
                      {(restrictIdaho
                        ? ALL_IDAHO_STANDARDS.filter(gs => idahoSubjectsTaught.includes(gs.subject))
                        : ALL_IDAHO_STANDARDS
                      ).map(gs => (
                        <SelectItem key={`${gs.subject}|${gs.grade}`} value={`${gs.subject}|${gs.grade}`}>
                          {gs.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search standards..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
              <ScrollArea className="h-64">
                {grouped.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">
                    {existingCodes.size > 0 && !search ? "All standards already added" : "No matching standards"}
                  </p>
                ) : (
                  <div className="p-1">
                    {grouped.map(([group, stds]) => (
                      <div key={group} className="mb-2">
                        <p className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase">{group}</p>
                        {stds.map(s => (
                          <button
                            key={s.code + ((s as any).category || "")}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-xs flex items-start gap-2 disabled:opacity-50"
                            onClick={() => handleAdd(s.code, s.description)}
                            disabled={adding === s.code}
                          >
                            <span className="font-mono text-primary shrink-0 mt-0.5">{s.code}</span>
                            <div className="min-w-0">
                              {(s as any).category && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 mr-1">
                                  {IDAHO_CATEGORY_LABELS[(s as any).category] || (s as any).category}
                                </Badge>
                              )}
                              <span className="text-muted-foreground line-clamp-2">{s.description}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {standards.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          {standards.map(s => (
            <Badge
              key={s.id}
              variant="outline"
              className="text-xs font-mono border-primary/30 text-primary gap-1 pr-1 group"
              title={`${s.ngss_code}: ${s.ngss_description}${s.matched_terms?.length ? `\nMatched: ${s.matched_terms.join(", ")}` : ""}`}
            >
              {s.ngss_code}
              <button
                onClick={() => onRemove(s.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          {tagging && <span className="text-xs text-muted-foreground animate-pulse">Tagging…</span>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {tagging ? "Auto-tagging in progress…" : "No standards tagged yet. Use Auto-tag or add manually."}
        </p>
      )}
    </div>
  );
}
