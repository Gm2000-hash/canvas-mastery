import { useRole } from "@/hooks/useRole";

/** Back-compat wrapper around useRole(). */
export function useIsAdmin() {
  const { isAdmin, loading } = useRole();
  return { isAdmin, loading };
}
