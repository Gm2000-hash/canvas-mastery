// In-memory reveal of real student names for a single course.
// Calling reveal() invokes the audited RPC; names live in component state only.
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RevealedRow = {
  student_id: string;
  real_name: string;
  real_sortable_name: string | null;
  email: string | null;
};

export function useRevealedNames(courseId: string | null | undefined) {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  const reveal = useCallback(async (reason?: string) => {
    if (!courseId) return false;
    setLoading(true);
    const { data, error } = await supabase.rpc("reveal_student_identities", {
      _course_id: courseId,
      _reason: reason ?? null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    const map: Record<string, string> = {};
    for (const r of (data as RevealedRow[]) ?? []) {
      map[r.student_id] = r.real_name;
    }
    setNames(map);
    setRevealed(true);
    return true;
  }, [courseId]);

  const hide = useCallback(() => {
    setRevealed(false);
    setNames({});
  }, []);

  const display = useCallback(
    (studentId: string, fallback: string) => (revealed ? names[studentId] ?? fallback : fallback),
    [revealed, names]
  );

  return { revealed, loading, names, reveal, hide, display };
}
