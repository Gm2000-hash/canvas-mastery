import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, Sparkles, Check, Trash2, RefreshCw, Edit2, Plus } from "lucide-react";
import { toast } from "sonner";

type Suggestion = {
  cluster_key: string;
  suggested_name: string;
  kind: "assignment" | "quiz";
  subject: string | null;
  grade: string | null;
  member_count: number;
  course_count: number;
  assignment_ids: string[];
  course_ids: string[];
  course_names: string[];
};

type Group = {
  group_id: string;
  name: string;
  kind: "assignment" | "quiz";
  subject: string | null;
  grade: string | null;
  confirmed: boolean;
  member_count: number;
  course_count: number;
  assignment_ids: string[] | null;
  course_names: string[] | null;
  total_submissions: number;
  avg_percentage: number | null;
};

export default function AssignmentGroups() {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    const [s, g] = await Promise.all([
      supabase.rpc("suggest_assignment_groups" as any),
      supabase.rpc("list_assignment_groups" as any),
    ]);
    if (s.error) toast.error(s.error.message);
    if (g.error) toast.error(g.error.message);
    setSuggestions(((s.data as any) ?? []) as Suggestion[]);
    setGroups(((g.data as any) ?? []) as Group[]);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  async function confirmGroup(s: Suggestion, customName?: string) {
    const { error } = await supabase.rpc("apply_assignment_group" as any, {
      _name: customName || s.suggested_name,
      _assignment_ids: s.assignment_ids,
      _group_id: null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Grouped ${s.member_count} assignments`);
    loadAll();
  }

  async function unlinkAssignment(assignmentId: string, groupId: string) {
    const { error } = await supabase.rpc("unlink_assignment_from_group" as any, { _assignment_id: assignmentId });
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment removed from group");
    loadAll();
  }

  async function deleteGroup(groupId: string) {
    if (!confirm("Delete this group? Member assignments will be ungrouped (no data lost).")) return;
    const { error } = await supabase.from("assignment_groups").delete().eq("id", groupId);
    if (error) { toast.error(error.message); return; }
    toast.success("Group deleted");
    loadAll();
  }

  async function renameGroup(groupId: string, name: string) {
    if (!name.trim()) return;
    const { error } = await supabase.from("assignment_groups").update({ name: name.trim() }).eq("id", groupId);
    if (error) { toast.error(error.message); return; }
    setEditing((e) => { const n = { ...e }; delete n[groupId]; return n; });
    toast.success("Renamed");
    loadAll();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight flex items-center gap-2">
            <Layers className="h-7 w-7" /> Assignment groups
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            When the same assignment is given in multiple sections (e.g., a Pre-ECA across two "8th Grade Science B" classes),
            group them so analytics treat them as one. Submissions, standards, and the Compare-classes chart are aggregated automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="suggestions">
        <TabsList>
          <TabsTrigger value="suggestions">
            <Sparkles className="h-4 w-4 mr-1.5" />
            Suggestions {suggestions && suggestions.length > 0 ? `(${suggestions.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            <Check className="h-4 w-4 mr-1.5" />
            Confirmed {groups && groups.length > 0 ? `(${groups.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-3 mt-4">
          {loading && !suggestions && <Skeleton className="h-32" />}
          {suggestions && suggestions.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
              No duplicate-looking assignments found. We look for the same assignment name across two or more of your classes.
            </CardContent></Card>
          )}
          {suggestions?.map((s) => (
            <Card key={s.cluster_key}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{s.suggested_name}</CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{s.kind}</Badge>
                      {s.subject && <Badge variant="outline">{s.subject}</Badge>}
                      {s.grade && <Badge variant="outline">{s.grade}</Badge>}
                      <Badge variant="outline">{s.course_count} classes</Badge>
                      <Badge variant="outline">{s.member_count} assignments</Badge>
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={() => confirmGroup(s)}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Confirm group
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Classes:</span>{" "}
                  {s.course_names.join(" · ")}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="confirmed" className="space-y-3 mt-4">
          {loading && !groups && <Skeleton className="h-32" />}
          {groups && groups.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
              No confirmed groups yet. Switch to Suggestions to create one.
            </CardContent></Card>
          )}
          {groups?.map((g) => (
            <Card key={g.group_id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {editing[g.group_id] !== undefined ? (
                      <div className="flex gap-2">
                        <Input
                          value={editing[g.group_id]}
                          onChange={(e) => setEditing({ ...editing, [g.group_id]: e.target.value })}
                          className="h-8"
                          autoFocus
                        />
                        <Button size="sm" onClick={() => renameGroup(g.group_id, editing[g.group_id])}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing((e) => { const n = { ...e }; delete n[g.group_id]; return n; })}>Cancel</Button>
                      </div>
                    ) : (
                      <CardTitle className="text-base truncate flex items-center gap-2">
                        {g.name}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing({ ...editing, [g.group_id]: g.name })}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardTitle>
                    )}
                    <CardDescription className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{g.kind}</Badge>
                      {g.subject && <Badge variant="outline">{g.subject}</Badge>}
                      <Badge variant="outline">{g.course_count} classes</Badge>
                      <Badge variant="outline">{g.member_count} assignments</Badge>
                      <Badge variant="outline">{g.total_submissions} submissions</Badge>
                      {g.avg_percentage != null && <Badge variant="outline">avg {Number(g.avg_percentage).toFixed(0)}%</Badge>}
                    </CardDescription>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteGroup(g.group_id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Classes:</span>{" "}
                  {(g.course_names ?? []).join(" · ")}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground">
        Tip: open the <Link to="/app/classes" className="underline">Compare classes</Link> tab on Analytics to chart a confirmed group across all its sections.
      </div>
    </div>
  );
}
