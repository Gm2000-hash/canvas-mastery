import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useAuth } from "../config/auth";

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export type ModelTier = "default" | "heavy" | "utility";

export interface AvailableModel {
  id: string;
  label: string;
  tier: ModelTier;
  description?: string;
}

export const AVAILABLE_MODELS: AvailableModel[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash Preview", tier: "default", description: "Newest fast model — recommended default" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "default", description: "Balanced, proven reliable" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", tier: "utility", description: "Fastest & cheapest — utility tasks" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "heavy", description: "Best for long, complex content" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", tier: "heavy", description: "Newest reasoning model" },
  { id: "openai/gpt-5", label: "GPT-5", tier: "heavy", description: "OpenAI's strongest all-rounder" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", tier: "default", description: "OpenAI balanced option" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano", tier: "utility", description: "OpenAI fast & cheap" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", tier: "heavy", description: "OpenAI's latest reasoning model" },
];

export interface AiPreferences {
  default_model: string;
  overrides: Partial<Record<ModelTier, string>>;
}

const EMPTY_PREFS: AiPreferences = {
  default_model: DEFAULT_MODEL,
  overrides: {},
};

function normalize(raw: unknown): AiPreferences {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PREFS };
  const obj = raw as Record<string, unknown>;
  const default_model = typeof obj.default_model === "string" && obj.default_model
    ? obj.default_model
    : DEFAULT_MODEL;
  const overrides: AiPreferences["overrides"] = {};
  const src = (obj.overrides && typeof obj.overrides === "object" ? obj.overrides : {}) as Record<string, unknown>;
  for (const tier of ["default", "heavy", "utility"] as ModelTier[]) {
    const v = src[tier];
    if (typeof v === "string" && v) overrides[tier] = v;
  }
  return { default_model, overrides };
}

export function useAiPreferences() {
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<AiPreferences>(EMPTY_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPreferences(EMPTY_PREFS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("ai_preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setPreferences(normalize((data as { ai_preferences?: unknown } | null)?.ai_preferences));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading]);

  const save = useCallback(async (next: AiPreferences) => {
    if (!user) return { error: new Error("Not signed in") };
    setPreferences(next);
    const { error } = await supabase
      .from("profiles")
      .update({ ai_preferences: next as unknown as never, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    return { error };
  }, [user]);

  /**
   * Returns the model id this user would use right now for a given tier,
   * mirroring the backend resolver.
   */
  const resolveLocal = useCallback((tier: ModelTier = "default"): string => {
    const override = preferences.overrides[tier];
    if (override) return override;
    return preferences.default_model || DEFAULT_MODEL;
  }, [preferences]);

  return { preferences, loading, save, resolveLocal };
}
