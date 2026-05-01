// Reveal real names for ALL of the caller's own students (across courses).
// Used on Department views. PIN-gated and audited server-side.
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RevealedRow = {
  student_id: string;
  real_name: string;
  real_sortable_name: string | null;
  email: string | null;
};

export function useRevealedNamesAll() {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  const reveal = useCallback(async (pin: string, reason?: string) => {
    if (!pin || pin.length < 6) {
      toast.error("Enter your security PIN.");
      return false;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("reveal_my_identities", {
      _reason: reason ?? null,
      _pin: pin,
    });
    setLoading(false);
    if (error) {
      const msg = (error.message || "").toUpperCase();
      if (msg.includes("PIN_NOT_SET")) toast.error("You haven't set a security PIN yet.");
      else if (msg.includes("PIN_INVALID")) toast.error("Incorrect PIN.");
      else toast.error(error.message);
      return false;
    }
    const map: Record<string, string> = {};
    for (const r of (data as RevealedRow[]) ?? []) map[r.student_id] = r.real_name;
    setNames(map);
    setRevealed(true);
    return true;
  }, []);

  const hide = useCallback(() => { setRevealed(false); setNames({}); }, []);

  const display = useCallback(
    (studentId: string, fallback: string) => (revealed ? names[studentId] ?? fallback : fallback),
    [revealed, names]
  );

  return { revealed, loading, names, reveal, hide, display };
}
