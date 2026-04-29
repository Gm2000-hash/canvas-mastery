import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Loader2, Plus, Ban } from "lucide-react";

type Invitation = {
  id: string;
  code: string;
  note: string | null;
  expires_at: string | null;
  used_by: string | null;
  used_at: string | null;
  revoked: boolean;
  created_at: string;
};

function statusOf(inv: Invitation): { label: string; tone: string } {
  if (inv.revoked) return { label: "Revoked", tone: "bg-muted text-muted-foreground" };
  if (inv.used_by) return { label: "Used", tone: "bg-mastery-high/10 text-mastery-high" };
  if (inv.expires_at && new Date(inv.expires_at) < new Date())
    return { label: "Expired", tone: "bg-muted text-muted-foreground" };
  return { label: "Available", tone: "bg-primary/10 text-primary" };
}

export default function InvitationsCard() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [expiresDays, setExpiresDays] = useState<string>("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("invitations")
      .select("id, code, note, expires_at, used_by, used_at, revoked, created_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setItems((data ?? []) as Invitation[]);
  }

  useEffect(() => { load(); }, []);

  async function createInvite() {
    setCreating(true);
    const days = expiresDays ? parseInt(expiresDays, 10) : 0;
    const expiresAt = days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const { data, error } = await supabase.rpc("create_invitation", {
      _note: note.trim() || null,
      _expires_at: expiresAt,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.code) {
      await navigator.clipboard.writeText(row.code).catch(() => {});
      toast.success(`Invite created · ${row.code} copied to clipboard`);
    } else {
      toast.success("Invite created");
    }
    setNote("");
    setExpiresDays("");
    load();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this invitation? It can no longer be redeemed.")) return;
    const { error } = await supabase
      .from("invitations").update({ revoked: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Invitation revoked");
    load();
  }

  async function copy(code: string) {
    await navigator.clipboard.writeText(code);
    toast.success("Copied");
  }

  return (
    <Card id="invitations">
      <CardHeader>
        <CardTitle>Invitations</CardTitle>
        <CardDescription>
          New teachers can only sign up with a valid invitation code. Create one and share it with whoever you want to invite.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md border p-4 space-y-3 bg-muted/20">
          <div className="grid sm:grid-cols-[1fr_140px_auto] gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="inv-note" className="text-xs">Note (optional)</Label>
              <Input
                id="inv-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Jane from math dept"
                maxLength={120}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-exp" className="text-xs">Expires in (days)</Label>
              <Input
                id="inv-exp"
                type="number"
                min={1}
                max={365}
                value={expiresDays}
                onChange={(e) => setExpiresDays(e.target.value)}
                placeholder="Never"
              />
            </div>
            <Button onClick={createInvite} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Create invite
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No invitations yet.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((inv) => {
              const s = statusOf(inv);
              const canRevoke = !inv.revoked && !inv.used_by;
              return (
                <div key={inv.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-code text-sm font-semibold">{inv.code}</code>
                      <span className={"text-[10px] px-2 py-0.5 rounded-full " + s.tone}>{s.label}</span>
                      {inv.note && <span className="text-xs text-muted-foreground truncate">· {inv.note}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(inv.created_at).toLocaleDateString()}
                      {inv.expires_at && ` · expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                      {inv.used_at && ` · used ${new Date(inv.used_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => copy(inv.code)} title="Copy code">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {canRevoke && (
                      <Button size="sm" variant="ghost" onClick={() => revoke(inv.id)} title="Revoke">
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
