// Host boundary shim — maps this app's useAuth onto the shape the module expects.
import { useAuth as useHostAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const base = useHostAuth();
  return { ...base, signOut: () => supabase.auth.signOut() };
}
