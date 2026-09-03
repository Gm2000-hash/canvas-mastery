// Role-aware hook: admin / principal / teacher, plus pending-principal state.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type RoleState = {
  isAdmin: boolean;
  isPrincipal: boolean;
  isTeacher: boolean;
  /** True when the user requested principal access and is awaiting a decision. */
  pending: boolean;
  /** No role at all and no pending request (legacy accounts). */
  hasAnyRole: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useRole(): RoleState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<Omit<RoleState, "refresh" | "loading">>({
    isAdmin: false, isPrincipal: false, isTeacher: false, pending: false, hasAnyRole: false,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [{ data: roles }, { data: req }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      (supabase as any).from("principal_requests").select("status").eq("user_id", user.id).maybeSingle(),
    ]);
    const set = new Set((roles ?? []).map((r: any) => r.role as string));
    const isAdmin = set.has("admin");
    const isPrincipal = set.has("principal");
    const isTeacher = set.has("teacher") || isAdmin;
    const pending = !isAdmin && !isPrincipal && !set.has("teacher") && (req as any)?.status === "pending";
    setState({ isAdmin, isPrincipal, isTeacher, pending, hasAnyRole: set.size > 0 });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ isAdmin: false, isPrincipal: false, isTeacher: false, pending: false, hasAnyRole: false });
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, refresh]);

  return { ...state, loading, refresh };
}
