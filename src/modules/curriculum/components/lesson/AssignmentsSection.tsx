import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ClipboardList, Plus, Sparkles, Wand2, FileText, Loader2, MoreHorizontal, Trash2, Pencil, FileSpreadsheet, Upload, ExternalLink, Presentation, Code2, Lock } from "lucide-react";
import { GenerateEscapeRoomDialog } from "@/modules/curriculum/components/GenerateEscapeRoomDialog";
import { useLessonAssignments, type LessonAssignment } from "@/modules/curriculum/hooks/useLessonAssignments";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";
import AssignmentBrainstormDialog from "./AssignmentBrainstormDialog";
import AssignmentEditorDialog from "./AssignmentEditorDialog";
import PushAssignmentToCanvasDialog from "./PushAssignmentToCanvasDialog";
import AppsScriptExportDialog from "./AppsScriptExportDialog";
import { useCanvasConfig } from "@/modules/curriculum/config/canvas-config";

interface Props {
  lessonPlanId: string;
  escapeRoomContext?: { title: string; topic: string; objectives: string; vocabulary: string };
}

export default function AssignmentsSection({ lessonPlanId, escapeRoomContext }: Props) {
  const { items, loading, create, update, remove, fetchItems } = useLessonAssignments(lessonPlanId);
  const [brainstormOpen, setBrainstormOpen] = useState(false);
  const [escapeRoomOpen, setEscapeRoomOpen] = useState(false);
  const [editing, setEditing] = useState<LessonAssignment | null>(null);
  const [pushing, setPushing] = useState<LessonAssignment | null>(null);
  const [appsScriptFor, setAppsScriptFor] = useState<LessonAssignment | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { config } = useCanvasConfig();

  const createBlank = async () => {
    const row = await create({ title: "Untitled assignment" });
    if (row) setEditing(row);
  };

  const exportTo = async (a: LessonAssignment, kind: "gdoc" | "gsheet" | "gslides") => {
    setExportingId(a.id);
    try {
      const fn =
        kind === "gdoc" ? "assignment-export-gdoc" :
        kind === "gsheet" ? "assignment-export-gsheet" :
        "assignment-export-gslides";
      const label =
        kind === "gdoc" ? "Google Doc" :
        kind === "gsheet" ? "Google Sheet" :
        "Google Slides";
      const { data, error } = await supabase.functions.invoke(fn, { body: { assignmentId: a.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${label} created`);
      window.open(data.url, "_blank");
      await fetchItems();
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setExportingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Assignments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setBrainstormOpen(true)} className="gap-2">
            <Sparkles className="h-3.5 w-3.5" /> Create assignment with AI
          </Button>
          {escapeRoomContext && (
            <Button size="sm" variant="outline" onClick={() => setEscapeRoomOpen(true)} className="gap-2">
              <Lock className="h-3.5 w-3.5" /> Escape Room
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={createBlank} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Blank
          </Button>
        </div>



        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet. Use AI to draft one in seconds.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-md border border-border/60">
            {items.map(a => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <button className="flex-1 text-left" onClick={() => setEditing(a)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{a.title}</span>
                    <Badge variant="secondary" className="text-[10px]">{a.assignment_type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{a.points_possible} pts</Badge>
                    {a.google_doc_url && <Badge variant="outline" className="text-[10px] gap-1"><FileText className="h-3 w-3" /> Doc</Badge>}
                    {a.google_sheet_url && <Badge variant="outline" className="text-[10px] gap-1"><FileSpreadsheet className="h-3 w-3" /> Sheet</Badge>}
                    {a.google_slides_url && <Badge variant="outline" className="text-[10px] gap-1"><Presentation className="h-3 w-3" /> Slides</Badge>}
                    {a.canvas_assignment_id && <Badge variant="outline" className="text-[10px]">Canvas</Badge>}
                  </div>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      {exportingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(a)}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportTo(a, "gdoc")}><FileText className="h-4 w-4 mr-2" /> Export to Google Doc</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportTo(a, "gsheet")}><FileSpreadsheet className="h-4 w-4 mr-2" /> Export rubric to Sheet</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportTo(a, "gslides")}><Presentation className="h-4 w-4 mr-2" /> Export to Google Slides</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAppsScriptFor(a)}><Code2 className="h-4 w-4 mr-2" /> Export as Apps Script (.gs)</DropdownMenuItem>
                    {a.google_doc_url && <DropdownMenuItem onClick={() => window.open(a.google_doc_url!, "_blank")}><ExternalLink className="h-4 w-4 mr-2" /> Open Doc</DropdownMenuItem>}
                    {a.google_slides_url && <DropdownMenuItem onClick={() => window.open(a.google_slides_url!, "_blank")}><ExternalLink className="h-4 w-4 mr-2" /> Open Slides</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={!config} onClick={() => config && setPushing(a)}><Upload className="h-4 w-4 mr-2" /> Push to Canvas{!config ? " (configure first)" : ""}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => remove(a.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AssignmentBrainstormDialog
        open={brainstormOpen}
        onOpenChange={setBrainstormOpen}
        lessonPlanId={lessonPlanId}
        onCreated={async () => { await fetchItems(); }}
      />

      <AssignmentEditorDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        assignment={editing}
        onSave={async (patch) => { if (editing) await update(editing.id, patch); }}
      />

      {pushing && config && (
        <PushAssignmentToCanvasDialog
          open={!!pushing}
          onOpenChange={(o) => { if (!o) setPushing(null); }}
          assignment={pushing}
          config={config}
        />
      )}

      <AppsScriptExportDialog
        open={!!appsScriptFor}
        onOpenChange={(o) => { if (!o) setAppsScriptFor(null); }}
        assignment={appsScriptFor}
      />
      <AppsScriptExportDialog
        open={!!appsScriptFor}
        onOpenChange={(o) => { if (!o) setAppsScriptFor(null); }}
        assignment={appsScriptFor}
      />

      {escapeRoomContext && (
        <GenerateEscapeRoomDialog
          open={escapeRoomOpen}
          onOpenChange={setEscapeRoomOpen}
          context={escapeRoomContext}
        />
      )}
    </Card>
  );
}
