import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Shield, ShieldOff, RefreshCw, Users, Database, Wrench } from "lucide-react";

type AdminUser = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  roles: ("admin" | "moderator" | "user")[];
};

type AppRole = "admin" | "moderator" | "user";

export default function Admin() {
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/app", { replace: true });
    }
  }, [isAdmin, roleLoading, navigate]);

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast.error(error.message);
    } else {
      setUsers((data as AdminUser[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  async function grantRole(userId: string, role: AppRole) {
    setBusy(userId + ":" + role);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role });
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
    } else {
      toast.success(`Granted ${role}`);
      await loadUsers();
    }
    setBusy(null);
  }

  async function revokeRole(userId: string, role: AppRole) {
    setBusy(userId + ":" + role);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Revoked ${role}`);
      await loadUsers();
    }
    setBusy(null);
  }

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Checking permissions…
      </div>
    );
  }
  if (!isAdmin) return null;

  const adminCount = users.filter((u) => u.roles.includes("admin")).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Admin</h1>
        <p className="text-muted-foreground mt-1">Manage users, roles, and platform diagnostics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total users</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="h-6 w-6 text-muted-foreground" /> {users.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Admins</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Shield className="h-6 w-6 text-muted-foreground" /> {adminCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Quick links</CardDescription>
            <div className="flex flex-wrap gap-2 mt-1">
              <Button size="sm" variant="outline" onClick={() => navigate("/app/mastery/debug")}>
                <Wrench className="h-4 w-4" /> Mastery debug
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/app/standards")}>
                <Database className="h-4 w-4" /> Standards
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Users & roles</CardTitle>
            <CardDescription>Grant or revoke admin/moderator access.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="font-medium">{u.display_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          Joined {new Date(u.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.email || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">teacher (default)</span>
                          ) : (
                            u.roles.map((r) => (
                              <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                                {r}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Select
                            onValueChange={(role) => grantRole(u.user_id, role as AppRole)}
                            disabled={!!busy}
                          >
                            <SelectTrigger className="w-[140px] h-9">
                              <SelectValue placeholder="Grant role…" />
                            </SelectTrigger>
                            <SelectContent>
                              {(["admin", "moderator", "user"] as AppRole[])
                                .filter((r) => !u.roles.includes(r))
                                .map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {u.roles.map((r) => (
                            <Button
                              key={r}
                              size="sm"
                              variant="outline"
                              onClick={() => revokeRole(u.user_id, r)}
                              disabled={busy === u.user_id + ":" + r}
                            >
                              <ShieldOff className="h-4 w-4" /> {r}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
