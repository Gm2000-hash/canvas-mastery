import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Shield, RefreshCw, Users, Database, Wrench, KeyRound, Check, X, School } from "lucide-react";

type AppRole = "admin" | "teacher" | "principal";
type AdminUser = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  roles: AppRole[];
  school: string | null;
  principal_status: "pending" | "approved" | "declined" | null;
};

export default function Admin() {
  const { isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [schoolDraft, setSchoolDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate("/app", { replace: true });
  }, [isAdmin, roleLoading, navigate]);

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) toast.error(error.message);
    else setUsers((data as unknown as AdminUser[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { if (isAdmin) loadUsers(); }, [isAdmin]);

  async function run(key: string, fn: () => Promise<{ error: any }>, ok: string) {
    setBusy(key);
    const { error } = await fn();
    if (error) toast.error(error.message); else { toast.success(ok); await loadUsers(); }
    setBusy(null);
  }

  const decide = (u: AdminUser, approve: boolean) =>
    run(u.user_id + ":decide", () => (supabase as any).rpc("approve_principal", { _user_id: u.user_id, _approve: approve }),
      approve ? "Principal approved" : "Request declined — user set as teacher");
  const setRole = (u: AdminUser, role: "teacher" | "principal") =>
    run(u.user_id + ":role", () => (supabase as any).rpc("admin_set_user_role", { _user_id: u.user_id, _role: role }), `Role set to ${role}`);
  const saveSchool = (u: AdminUser) =>
    run(u.user_id + ":school", () => (supabase as any).rpc("admin_set_user_school", { _user_id: u.user_id, _school: schoolDraft[u.user_id] ?? u.school ?? "" }), "School updated");

  async function resetPin(userId: string, displayName: string | null) {
    if (!confirm(`Reset security PIN for ${displayName || "this user"}? They will be prompted to choose a new PIN on next sign-in.`)) return;
    await run(userId + ":pin", () => supabase.rpc("admin_reset_security_pin", { _user_id: userId }), "Security PIN reset.");
  }

  if (roleLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Checking permissions…</div>;
  }
  if (!isAdmin) return null;

  const pending = users.filter((u) => u.principal_status === "pending");
  const principals = users.filter((u) => u.roles.includes("principal")).length;
  const primaryRole = (u: AdminUser): AppRole | null => u.roles.includes("admin") ? "admin" : u.roles.includes("principal") ? "principal" : u.roles.includes("teacher") ? "teacher" : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Admin</h1>
        <p className="text-muted-foreground mt-1">Approve principals, manage roles and schools, and reach platform diagnostics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total users</CardDescription><CardTitle className="text-3xl flex items-center gap-2"><Users className="h-6 w-6 text-muted-foreground" /> {users.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Principals</CardDescription><CardTitle className="text-3xl flex items-center gap-2"><School className="h-6 w-6 text-muted-foreground" /> {principals}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Pending approvals</CardDescription><CardTitle className="text-3xl flex items-center gap-2"><Shield className="h-6 w-6 text-muted-foreground" /> {pending.length}</CardTitle></CardHeader></Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Quick links</CardDescription>
            <div className="flex flex-wrap gap-2 mt-1">
              <Button size="sm" variant="outline" onClick={() => navigate("/app/mastery/debug")}><Wrench className="h-4 w-4" /> Mastery debug</Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/app/library?view=standards")}><Database className="h-4 w-4" /> Standards</Button>
            </div>
          </CardHeader>
        </Card>
      </div>

      {pending.length > 0 && (
        <Card className="border-accent/50">
          <CardHeader>
            <CardTitle>Principal requests</CardTitle>
            <CardDescription>These users asked for building-level access. Approving removes teacher tools and unlocks Building Analytics for their school.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((u) => (
              <div key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                <div>
                  <div className="font-medium">{u.display_name || u.email || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email} · {u.school || "no school"} · requested {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(u, true)} disabled={!!busy}><Check className="h-4 w-4" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => decide(u, false)} disabled={!!busy}><X className="h-4 w-4" /> Decline</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>Set each user's role (teacher or principal) and school. The admin role is fixed to your account.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users…</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const role = primaryRole(u);
                    const isOwner = role === "admin";
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <div className="font-medium">{u.display_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{u.email} · joined {new Date(u.created_at).toLocaleDateString()}</div>
                        </TableCell>
                        <TableCell>
                          {isOwner ? <Badge>admin</Badge> : (
                            <div className="flex items-center gap-2">
                              <Select value={role ?? ""} onValueChange={(r) => setRole(u, r as "teacher" | "principal")} disabled={!!busy}>
                                <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="no role" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="teacher">teacher</SelectItem>
                                  <SelectItem value="principal">principal</SelectItem>
                                </SelectContent>
                              </Select>
                              {u.principal_status === "pending" && <Badge variant="outline">pending</Badge>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input className="h-9 w-[180px]" value={schoolDraft[u.user_id] ?? u.school ?? ""} placeholder="School"
                              onChange={(e) => setSchoolDraft({ ...schoolDraft, [u.user_id]: e.target.value })} />
                            {(schoolDraft[u.user_id] ?? u.school ?? "") !== (u.school ?? "") && (
                              <Button size="sm" variant="secondary" className="h-9" onClick={() => saveSchool(u)} disabled={busy === u.user_id + ":school"}>Save</Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => resetPin(u.user_id, u.display_name)} disabled={busy === u.user_id + ":pin"} title="Clear this user's security PIN">
                            <KeyRound className="h-4 w-4" /> Reset PIN
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
