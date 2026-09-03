import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StandardOpt = { id: string; code: string; description: string; subject: string; grade: string; framework: string | null };

let cache: StandardOpt[] | null = null;

/** Loads the full standards list once per session (global + teacher-owned rows, RLS-scoped). */
export function useStandardOptions() {
  const [standards, setStandards] = useState<StandardOpt[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  useEffect(() => {
    if (cache) return;
    (async () => {
      const out: StandardOpt[] = [];
      for (let from = 0; from < 20000; from += 1000) {
        const { data } = await supabase.from("standards")
          .select("id, code, description, subject, grade, framework")
          .order("subject").order("code").range(from, from + 999);
        if (!data?.length) break;
        out.push(...(data as StandardOpt[]));
        if (data.length < 1000) break;
      }
      cache = out;
      setStandards(out);
      setLoading(false);
    })();
  }, []);
  return { standards, loading };
}

export function StandardsPicker({ value, onChange, multiple = true, placeholder = "Select standards…", subjectHint }: {
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  subjectHint?: string | null;
}) {
  const { standards } = useStandardOptions();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(standards.map((s) => [s.id, s])), [standards]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = standards;
    if (!needle && subjectHint) list = list.filter((s) => s.subject === subjectHint);
    if (needle) list = list.filter((s) => s.code.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle));
    return list.slice(0, 80);
  }, [standards, q, subjectHint]);

  function toggle(id: string) {
    if (!multiple) { onChange([id]); setOpen(false); return; }
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
            <span className="truncate text-muted-foreground">
              {!multiple && value[0] && byId.get(value[0]) ? byId.get(value[0])!.code : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search code or description…" value={q} onValueChange={setQ} />
            <CommandList>
              <CommandEmpty>No standards match.</CommandEmpty>
              <CommandGroup>
                {filtered.map((s) => (
                  <CommandItem key={s.id} value={s.id} onSelect={() => toggle(s.id)} className="items-start gap-2">
                    <Check className={cn("h-4 w-4 mt-0.5 shrink-0", value.includes(s.id) ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{s.code} <span className="text-xs text-muted-foreground font-normal">· {s.subject} · Gr {s.grade}</span></div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{s.description}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {multiple && value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const s = byId.get(id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {s?.code ?? "…"}
                <button type="button" onClick={() => toggle(id)} className="rounded-full hover:bg-muted p-0.5" aria-label={`Remove ${s?.code}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
