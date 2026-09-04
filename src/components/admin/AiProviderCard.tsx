import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Coins, KeyRound, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Tier = "default" | "bulk" | "heavy";
type Status = {
  provider: "openrouter" | "lovable";
  keySource: "admin" | "env" | "none";
  keyHint: string | null;
  setBy: string | null;
  setAt: string | null;
  keyError: string | null;
  lovableAvailable: boolean;
  threshold: number;
  credits: { total: number; used: number; remaining: number } | null;
  low: boolean;
  chains: Record<Tier, string[]>;
  history: { hint: string | null; action: "set" | "removed"; by: string | null; set_at: string }[];
};

const TIER_LABEL: Record<Tier, string> = { default: "Everyday", bulk: "Bulk tagging", heavy: "Heavy jobs" };

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

export function AiProviderCard() {
  const [data, setData] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const call = async (body?: Record<string, unknown>) => {
    const { data: res, error: err } = await supabase.functions.invoke("ai-provider-admin", { body: body ?? { action: "status" } });
    if (err) {
      let msg = err.message;
      try { msg = (await (err as { context?: Response }).context?.json())?.error ?? msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    if (res?.error) throw new Error(res.error);
    return res;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try { setData((await call()) as Status); } catch (e) { setError((e as Error).message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      const res = await call({ action: "set_openrouter_key", key });
      toast.success(`Key saved — balance $${Number(res.credits?.remaining ?? 0).toFixed(2)}. Active for all teachers within a minute.`);
      setKey("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!confirm("Remove the admin-entered OpenRouter key? AI will fall back to the built-in provider (workspace credits).")) return;
    setRemoving(true);
    try { await call({ action: "remove_openrouter_key" }); toast.success("Key removed."); await load(); } catch (e) { toast.error((e as Error).message); }
    setRemoving(false);
  };

  const remaining = data?.credits?.remaining;
  const empty = remaining !== undefined && remaining <= 0.01;

  return (
    <Card className={data?.low || data?.keyError ? "border-destructive/60" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardDescription>AI provider (shared by all teachers)</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Coins className="h-6 w-6 text-muted-foreground" />
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : error ? "—" : data?.provider === "lovable" ? "Built-in AI" : remaining !== undefined ? `$${remaining.toFixed(2)}` : "n/a"}
            </CardTitle>
          </div>
          <Button size="icon" variant="ghost" onClick={load} disabled={loading} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        {error && <p className="text-destructive">{error}</p>}
        {data?.keyError && (
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertTriangle className="h-4 w-4" />
            {data.keyError}
          </div>
        )}
        {data?.low && (
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertTriangle className="h-4 w-4" />
            {empty ? "Empty — every teacher's AI tools are paused. Add credits at openrouter.ai or enter a different key below." : `Below $${data.threshold} — top up soon at openrouter.ai.`}
          </div>
        )}
        {data && !data.low && data.credits && <p>Used ${data.credits.used.toFixed(2)} of ${data.credits.total.toFixed(2)} purchased on OpenRouter.</p>}
        {data?.provider === "lovable" && <p>Running on built-in Lovable AI; usage is billed from workspace credits. Enter an OpenRouter key below to switch.</p>}

        {data && (
          <div className="flex flex-wrap items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {data.keySource === "none" && <span>No OpenRouter key.</span>}
            {data.keySource !== "none" && (
              <>
                <span className="font-mono text-foreground">{data.keyHint}</span>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {data.keySource === "admin" ? `entered by ${data.setBy ?? "an admin"} · ${fmtDate(data.setAt)}` : "from project secret"}
                </Badge>
                {data.keySource === "admin" && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={remove} disabled={removing}>
                    {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Remove
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Input
            type="password"
            autoComplete="off"
            placeholder="Paste a new OpenRouter key (sk-or-v1-…)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-8 text-xs font-mono"
            aria-label="New OpenRouter key"
          />
          <Button type="submit" size="sm" className="h-8" disabled={saving || !key.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Test &amp; save
          </Button>
        </form>

        {data && (
          <div className="space-y-1 pt-1">
            {(Object.keys(data.chains) as Tier[]).map((t) => (
              <div key={t} className="flex flex-wrap items-center gap-1">
                <span className="w-24 shrink-0">{TIER_LABEL[t]}:</span>
                {data.chains[t].map((m, i) => (
                  <Badge key={m} variant="secondary" className="text-[10px] font-normal">{i + 1}. {m.split("/")[1]}</Badge>
                ))}
              </div>
            ))}
          </div>
        )}

        {data && data.history.length > 0 && (
          <div className="pt-1">
            <p className="font-medium text-foreground mb-1">Key history</p>
            <ul className="space-y-0.5">
              {data.history.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-36 shrink-0">{fmtDate(h.set_at)}</span>
                  <span>{h.action === "set" ? "Set" : "Removed"} <span className="font-mono">{h.hint ?? ""}</span>{h.by ? ` by ${h.by}` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
