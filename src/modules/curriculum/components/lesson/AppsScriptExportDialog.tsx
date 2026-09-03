import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Download, Check, ExternalLink, Sparkles, Loader2, RefreshCw, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/modules/curriculum/config/supabase";
import type { LessonAssignment, QuizQuestion } from "@/modules/curriculum/hooks/useLessonAssignments";
import { generateAppsScript, downloadAppsScript } from "@/modules/curriculum/config/appscript";
import { generateCanvasHtml, downloadCanvasHtml } from "@/modules/curriculum/config/canvas-assignment-html";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: LessonAssignment | null;
}

export default function AppsScriptExportDialog({ open, onOpenChange, assignment }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Local override so the dialog reflects newly generated questions without re-fetching the parent list.
  const [localQuestions, setLocalQuestions] = useState<QuizQuestion[] | null>(null);

  const effective: LessonAssignment | null = useMemo(
    () => (assignment ? (localQuestions ? { ...assignment, quiz_questions: localQuestions } : assignment) : null),
    [assignment, localQuestions],
  );

  if (!assignment || !effective) return null;
  const questions = effective.quiz_questions || [];
  const code = generateAppsScript(effective);
  const canvasHtml = generateCanvasHtml(effective);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const copyHtml = async () => {
    await navigator.clipboard.writeText(canvasHtml);
    setCopiedHtml(true);
    toast.success("Copied Canvas HTML");
    setTimeout(() => setCopiedHtml(false), 1500);
  };

  const generateQuestions = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-assignment-questions", {
        body: { assignmentId: assignment.id, count: 10 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLocalQuestions(data.questions || []);
      setShowPreview(true);
      toast.success(`Generated ${data.questions?.length || 0} questions`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  };

  const clearQuestions = async () => {
    setClearing(true);
    try {
      const { error } = await (supabase.from("lesson_assignments") as any)
        .update({ quiz_questions: [] })
        .eq("id", assignment.id);
      if (error) throw error;
      setLocalQuestions([]);
      toast.success("Cleared quiz questions");
    } catch (e: any) {
      toast.error(e?.message || "Failed to clear");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export assignment</DialogTitle>
          <DialogDescription>
            Choose a format. <strong>Apps Script</strong> auto-builds a Doc, Sheet, graded Form, and Slides in your Drive.{" "}
            <strong>Canvas HTML</strong> pastes a clean, printable assignment block (instructions, materials, rubric, optional quiz) directly into a Canvas page or assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium">Quiz questions (used by Form & Canvas HTML)</span>
              {questions.length > 0 && <Badge variant="secondary">{questions.length}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              {questions.length === 0 ? (
                <Button size="sm" onClick={generateQuestions} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate with AI
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={generateQuestions} disabled={generating} className="gap-2">
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Regenerate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearQuestions} disabled={clearing} className="gap-2 text-destructive">
                    {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>
          {questions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Without questions, the Form is a blank submission box and the Canvas HTML has no quiz section.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowPreview(v => !v)}
                className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
              >
                {showPreview ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {showPreview ? "Hide" : "Preview"} questions
              </button>
              {showPreview && (
                <ol className="text-xs space-y-1.5 list-decimal pl-5 max-h-48 overflow-auto">
                  {questions.map((q, i) => (
                    <li key={i}>
                      <span className="font-medium">{q.prompt}</span>{" "}
                      <Badge variant="outline" className="text-[10px] ml-1">{q.type.replace("_", " ")}</Badge>{" "}
                      <span className="text-muted-foreground">({q.points} pt{q.points === 1 ? "" : "s"})</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>

        <Tabs defaultValue="appscript" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="appscript">Google Apps Script</TabsTrigger>
            <TabsTrigger value="canvas">Canvas HTML</TabsTrigger>
          </TabsList>

          <TabsContent value="appscript" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Paste into a new project at{" "}
              <a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
                script.google.com <ExternalLink className="h-3 w-3" />
              </a>{" "}
              and run <code className="text-xs bg-muted px-1 rounded">createAll</code>. Files appear in your Drive.
            </p>
            <pre className="max-h-[36vh] overflow-auto rounded-md border bg-muted/40 p-3 text-xs font-mono">
              <code>{code}</code>
            </pre>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={copy} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy code"}
              </Button>
              <Button onClick={() => downloadAppsScript(effective)} className="gap-2">
                <Download className="h-4 w-4" /> Download .gs file
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="canvas" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              In Canvas, open a Page or Assignment → click the <strong>HTML editor</strong> toggle (<code className="text-xs bg-muted px-1 rounded">&lt;/&gt;</code>) in the Rich Content Editor → paste. Switch back to the visual view to see it rendered.
            </p>
            <div className="rounded-md border bg-background p-3 max-h-[28vh] overflow-auto">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Live preview</div>
              <div dangerouslySetInnerHTML={{ __html: canvasHtml }} />
            </div>
            <pre className="max-h-[20vh] overflow-auto rounded-md border bg-muted/40 p-3 text-xs font-mono">
              <code>{canvasHtml}</code>
            </pre>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={copyHtml} className="gap-2">
                {copiedHtml ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedHtml ? "Copied" : "Copy HTML"}
              </Button>
              <Button onClick={() => downloadCanvasHtml(effective)} className="gap-2">
                <Download className="h-4 w-4" /> Download .html file
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
