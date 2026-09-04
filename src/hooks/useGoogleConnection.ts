// Per-teacher Google connection status + connect/disconnect actions.
// Consent happens in a Google-hosted page; the server keeps the tokens.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type GoogleStatus = { connected: boolean; email: string | null; connectedAt: string | null };

const POPUP_NAME = "stdtrack-google-connect";
const MSG = "stdtrack:google-connected";

export function useGoogleConnection() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_google_connection_status");
    if (error) { setStatus({ connected: false, email: null, connectedAt: null }); return; }
    const row = Array.isArray(data) ? data[0] : null;
    setStatus(row ? { connected: true, email: row.email ?? null, connectedAt: row.connected_at ?? null } : { connected: false, email: null, connectedAt: null });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Popup → opener handoff.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data === MSG) refresh(); };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [refresh]);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const returnTo = `${window.location.origin}/app/settings`;
      const { data, error } = await supabase.functions.invoke("google-oauth-start", { body: { return_to: returnTo } });
      const msg = (error as any)?.message ?? (data as any)?.error;
      if (msg) throw new Error(String(msg));
      const url = (data as any).url as string;
      // Google refuses to render inside iframes (the editor preview), so always use a popup/tab.
      const w = window.open(url, POPUP_NAME, "popup=yes,width=520,height=680");
      if (!w) window.location.href = url;
    } catch (e: any) {
      toast.error(e.message ?? "Could not start Google sign-in");
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("google-disconnect", { body: {} });
    setBusy(false);
    const msg = (error as any)?.message ?? (data as any)?.error;
    if (msg) { toast.error(String(msg)); return; }
    toast.success("Google disconnected");
    refresh();
  }, [refresh]);

  return { status, busy, connect, disconnect, refresh };
}

/**
 * Call once on the Settings page: reads ?google=connected|error from the OAuth
 * return, shows a toast, notifies the opener (popup flow) and cleans the URL.
 */
export function handleGoogleReturn(): "connected" | "error" | null {
  const url = new URL(window.location.href);
  const result = url.searchParams.get("google");
  if (!result) return null;
  const message = url.searchParams.get("message");
  url.searchParams.delete("google"); url.searchParams.delete("message");
  window.history.replaceState({}, "", url.toString());
  if (result === "connected") {
    if (window.opener && window.name === POPUP_NAME) {
      try { window.opener.postMessage(MSG, window.location.origin); } catch { /* ignore */ }
      window.close();
    }
    toast.success("Google connected");
    return "connected";
  }
  toast.error(message ?? "Google sign-in failed");
  return "error";
}
