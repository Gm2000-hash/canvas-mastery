import { useCallback, useEffect, useState } from "react";

const storageKey = (userId?: string) => `dashboard-layout:${userId ?? "anon"}`;

export function useDashboardLayout(userId?: string) {
  const [layout, setLayout] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey(userId));
      setLayout(raw ? JSON.parse(raw) : null);
    } catch {
      setLayout(null);
    }
    setLoading(false);
  }, [userId]);

  const saveLayout = useCallback(
    async (next: any) => {
      setLayout(next);
      try {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [userId],
  );

  const resetLayout = useCallback(async () => {
    setLayout(null);
    try {
      window.localStorage.removeItem(storageKey(userId));
    } catch {
      /* ignore */
    }
  }, [userId]);

  return { layout, loading, saveLayout, resetLayout };
}
