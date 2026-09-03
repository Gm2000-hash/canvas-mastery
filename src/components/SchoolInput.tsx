// Free-text school field with suggestions from schools already entered.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Skip suggestion loading (e.g. on the public sign-up page before auth). */
  disableSuggestions?: boolean;
};

export function SchoolInput({ id = "school", value, onChange, placeholder = "e.g. Sugar-Salem Jr. High", required, disableSuggestions }: Props) {
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    if (disableSuggestions) return;
    (supabase as any).from("schools").select("name").order("name").then(({ data }: any) => {
      setOptions((data ?? []).map((r: any) => r.name as string));
    });
  }, [disableSuggestions]);
  const listId = `${id}-options`;
  return (
    <>
      <Input id={id} list={options.length ? listId : undefined} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} maxLength={120} required={required} autoComplete="organization" />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((o) => <option key={o} value={o} />)}
        </datalist>
      )}
    </>
  );
}
