import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Coins, Loader2, RefreshCw } from "lucide-react";

type Balance = {
  provider: "openrouter" | "lovable";
  threshold: number;
  credits: { total: number; used: number; remaining: number } | null;
  low: boolean;
  chains: Record<"default" | "heavy", string[]>;
};

export function AiBalanceCard() {
  const [data, setData] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.functions.invoke("ai-balance");
    if (err || res?.error) setError(res?.error ?? err?.message ?? "Could not load balance");
    else setData(res as Balance);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remaining = data?.credits?.remaining;
  const empty = remaining !== undefined && remaining <= 0.01;

  return (
    <Card className={data?.low ? "border-destructive/60" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardDescription>AI balance (shared by all teachers)</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Coins className="h-6 w-6 text-muted-foreground" />
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : error ? "—" : remaining !== undefined ? `$${remaining.toFixed(2)}` : "n/a"}
            </CardTitle>
          </div>
          <Button size="icon" variant="ghost" onClick={load} disabled={loading} aria-label="Refresh balance">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        {error && <p className="text-destructive">{error}</p>}
        {data?.low && (
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertTriangle className="h-4 w-4" />
            {empty ? "Empty — every teacher's AI tools are paused. Add credits at openrouter.ai." : `Below $${data.threshold} — top up soon at openrouter.ai.`}
          </div>
        )}
        {data && !data.low && data.credits && <p>Used ${data.credits.used.toFixed(2)} of ${data.credits.total.toFixed(2)} purchased.</p>}
        {data?.provider === "lovable" && <p>Running on built-in Lovable AI; balance is tracked in workspace credits.</p>}
        {data && (
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="mr-1">Fallback order:</span>
            {data.chains.default.map((m, i) => (
              <Badge key={m} variant="secondary" className="text-[10px] font-normal">{i + 1}. {m.split("/")[1]}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
