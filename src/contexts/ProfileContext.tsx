// Shared profile store. Any page can read the current teacher's profile,
// trigger a refresh, or push an optimistic update after saving — and every
// subscriber re-renders automatically. This replaces the per-page reloads
// and the ad-hoc "profile:updated" window event.
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  display_name: string | null;
  state: string | null;
  default_subject: string | null;
  default_grade: string | null;
  school: string | null;
  email: string | null;
};

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  /** Force a re-fetch from the database. */
  refresh: () => Promise<void>;
  /** Merge fields into the in-memory profile (does NOT write to the DB). */
  patch: (fields: Partial<Profile>) => void;
  /** Convenience: the name to greet the user by, with email fallback. */
  preferredName: string;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    userIdRef.current = user?.id ?? null;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, state, default_subject, default_grade, school")
      .eq("id", user.id)
      .maybeSingle();
    setProfile({
      id: user.id,
      display_name: data?.display_name ?? null,
      state: data?.state ?? null,
      default_subject: data?.default_subject ?? null,
      default_grade: data?.default_grade ?? null,
      school: (data as any)?.school ?? null,
      email: user.email ?? null,
    });
    setLoading(false);
  }, []);

  const patch = useCallback((fields: Partial<Profile>) => {
    setProfile((prev) => (prev ? { ...prev, ...fields } : prev));
  }, []);

  // Initial load + react to auth changes (sign in / out / token refresh).
  useEffect(() => {
    refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id !== userIdRef.current) refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const preferredName = useMemo(() => {
    const name = profile?.display_name?.trim();
    if (name) return name;
    return profile?.email ?? "";
  }, [profile?.display_name, profile?.email]);

  const value = useMemo(
    () => ({ profile, loading, refresh, patch, preferredName }),
    [profile, loading, refresh, patch, preferredName]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
  return ctx;
}
