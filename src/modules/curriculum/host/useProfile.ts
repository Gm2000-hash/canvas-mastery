import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const SUBJECT_OPTIONS = [
  "Science",
  "Math",
  "English Language Arts",
  "Social Studies",
  "Computer Science",
  "Career & Technical Education",
  "Health",
  "Art",
] as const;

export type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  subjects: string[];
  grade_levels: string[];
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  website: string | null;
  ai_preferences: Record<string, unknown>;
};

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    const row = data as Record<string, unknown> | null;
    setProfile(
      row
        ? {
            id: String(row.id),
            user_id: String(row.id),
            display_name: (row.display_name as string | null) ?? user.email ?? "",
            email: user.email ?? "",
            subjects: (row.subjects as string[] | null) ?? (row.default_subject ? [String(row.default_subject)] : []),
            grade_levels: (row.grade_levels as string[] | null) ?? (row.default_grade ? [String(row.default_grade)] : []),
            avatar_url: (row.avatar_url as string | null) ?? null,
            bio: null,
            phone: null,
            website: null,
            ai_preferences: (row.ai_preferences as Record<string, unknown> | null) ?? {},
          }
        : null,
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!user) return;
      await supabase.from("profiles").update(patch as never).eq("id", user.id);
      await load();
    },
    [user, load],
  );

  return { profile, loading, refresh: load, updateProfile };
}
