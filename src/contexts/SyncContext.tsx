import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CanvasSyncBody = {
  course_ids?: number[];
  discipline_assignments?: Array<{ canvas_course_id: number; discipline_id: string | null }>;
};

export type CanvasSyncResult = {
  ok: boolean;
  error?: string;
  stats?: { courses?: number; students?: number; assignments?: number; submissions?: number };
  question_scores?: { quizzes?: number; responses?: number };
  archived?: { courses_archived?: number; students_archived?: number };
};

type SyncState = {
  syncing: boolean;
  startedAt: Date | null;
  label: string;
  runCanvasSync: (body?: CanvasSyncBody) => Promise<CanvasSyncResult>;
};

const SyncContext = createContext<SyncState | null>(null);

const STORAGE_KEY = "stdtrack:canvas-sync";
const STALE_MS = 10 * 60 * 1000; // 10 minutes

type Persisted = { startedAt: string; label: string; userId: string | null };

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    if (!p?.startedAt) return null;
    if (Date.now() - new Date(p.startedAt).getTime() > STALE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncing, setSyncing] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [label, setLabel] = useState("Syncing Canvas…");
  const inflightRef = useRef(false);
  const pollRef = useRef<number | null>(null);

  const finish = useCallback((emit = true) => {
    inflightRef.current = false;
    setSyncing(false);
    setStartedAt(null);
    localStorage.removeItem(STORAGE_KEY);
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (emit) window.dispatchEvent(new CustomEvent("canvas-sync:done"));
  }, []);

  const runCanvasSync = useCallback(async (body?: CanvasSyncBody) => {
    if (inflightRef.current) {
      toast.info("A Canvas sync is already running");
      return;
    }
    inflightRef.current = true;
    const started = new Date();
    setSyncing(true);
    setStartedAt(started);
    setLabel("Syncing Canvas…");
    try {
      const { data: userData } = await supabase.auth.getUser();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ startedAt: started.toISOString(), label: "Syncing Canvas…", userId: userData.user?.id ?? null } satisfies Persisted),
      );
    } catch {
      /* ignore */
    }

    const { data, error } = await supabase.functions.invoke("canvas-sync", body ? { body } : {});

    if (error) {
      toast.error((error as any).message ?? "Canvas sync failed");
      finish();
      return;
    }
    if ((data as any)?.error) {
      toast.error((data as any).error);
      finish();
      return;
    }
    const s = (data as any)?.stats;
    if (s) {
      toast.success(
        `Synced: ${s.courses ?? 0} course${s.courses === 1 ? "" : "s"} · ${s.students ?? 0} students · ${s.assignments ?? 0} assignments`,
      );
    } else {
      toast.success("Canvas sync complete");
    }
    finish();
  }, [finish]);

  // On mount: if a sync was started recently and we lost the result (full reload),
  // poll canvas_credentials.last_sync_at until it advances past startedAt.
  useEffect(() => {
    const p = loadPersisted();
    if (!p) return;
    const started = new Date(p.startedAt);
    setSyncing(true);
    setStartedAt(started);
    setLabel(p.label || "Syncing Canvas…");
    inflightRef.current = true;

    const poll = async () => {
      // Stop if too old
      if (Date.now() - started.getTime() > STALE_MS) {
        toast.info("Canvas sync state cleared (timed out)");
        finish(false);
        return;
      }
      const { data, error } = await supabase.rpc("get_canvas_connection_status");
      if (error) return;
      const row = Array.isArray(data) ? data[0] : null;
      const last = row?.last_sync_at ? new Date(row.last_sync_at) : null;
      if (last && last.getTime() >= started.getTime() - 1000) {
        toast.success("Canvas sync finished");
        finish();
      }
    };
    poll();
    pollRef.current = window.setInterval(poll, 4000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SyncContext.Provider value={{ syncing, startedAt, label, runCanvasSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}

export function SyncStatusPill() {
  const { syncing, startedAt, label } = useSync();
  const [, force] = useState(0);
  useEffect(() => {
    if (!syncing) return;
    const t = window.setInterval(() => force((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [syncing]);

  if (!syncing) return null;
  const seconds = startedAt ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)) : 0;
  const elapsed = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return (
    <div className="fixed top-4 right-6 z-50 flex items-center gap-2 rounded-full border border-accent/40 bg-card/95 backdrop-blur px-3 py-1.5 text-xs shadow-md">
      <svg className="h-3.5 w-3.5 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground tabular-nums">· {elapsed}</span>
    </div>
  );
}
