import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Wand2, MousePointerClick, ImageIcon, Check, RefreshCw } from "lucide-react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";
import { MathText } from "@/modules/curriculum/components/MathText";
import type { MediaEmbed } from "@/modules/curriculum/lib/h5p-types";

export interface EnhanceQuestion {
  question_number: number;
  question_type: string;
  question_text: string;
  standard_code?: string;
  standard_description?: string;
  dok_level?: number;
  answers?: any;
  image_url?: string;
  media?: MediaEmbed;
}

export interface EnhanceResult {
  image_url?: string;
  media?: MediaEmbed;
  question_text?: string;
  answers?: any;
  dok_level?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: EnhanceQuestion | null;
  onApply: (result: EnhanceResult) => void;
  headerExtra?: React.ReactNode;
}

type Format = "diagram" | "drag_and_drop" | "image_hotspots";

export function EnhanceQuestionDialog({ open, onOpenChange, question, onApply, headerExtra }: Props) {
  const [format, setFormat] = useState<Format>("diagram");
  const [prompt, setPrompt] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rewrite, setRewrite] = useState(true);
  const [preview, setPreview] = useState<{
    image_url: string;
    activity_id?: string;
    activity_type?: string;
    suggested_question_text?: string;
    suggested_answers?: any;
    suggested_dok?: number;
  } | null>(null);

  // Auto-suggest prompt when dialog opens or format changes
  useEffect(() => {
    if (!open || !question) return;
    setPreview(null);
    setPrompt("");
    setSuggesting(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-question-image", {
          body: {
            mode: "suggest_prompt",
            question_text: question.question_text,
            question_type: question.question_type,
            standard_code: question.standard_code,
            standard_description: question.standard_description,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setPrompt(data?.suggested_prompt || "");
      } catch (e: any) {
        console.warn("Suggest prompt failed:", e?.message);
      } finally {
        setSuggesting(false);
      }
    })();
  }, [open, question?.question_number]);

  const handleGenerate = async () => {
    if (!question || !prompt.trim()) {
      toast.error("Enter a prompt for the visual");
      return;
    }
    setGenerating(true);
    setPreview(null);
    try {
      if (format === "diagram") {
        // Use existing image generator endpoint, then optionally call enhance for the rewrite
        const { data, error } = await supabase.functions.invoke("generate-question-image", {
          body: {
            prompt: prompt.trim(),
            question_text: question.question_text,
            question_type: question.question_type,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        let suggested_question_text: string | undefined;
        let suggested_answers: any;
        let suggested_dok: number | undefined;

        if (rewrite) {
          // Call enhance fn in diagram mode purely for the rewrite payload
          const { data: rData } = await supabase.functions.invoke("enhance-question-manipulative", {
            body: {
              prompt: prompt.trim(),
              question_text: question.question_text,
              question_type: question.question_type,
              standard_code: question.standard_code,
              format: "diagram",
              rewrite: true,
              current_dok: question.dok_level,
            },
          });
          if (rData) {
            suggested_question_text = rData.suggested_question_text;
            suggested_answers = rData.suggested_answers;
            suggested_dok = rData.suggested_dok;
          }
        }

        setPreview({
          image_url: data.image_url,
          suggested_question_text,
          suggested_answers,
          suggested_dok,
        });
      } else {
        const { data, error } = await supabase.functions.invoke("enhance-question-manipulative", {
          body: {
            prompt: prompt.trim(),
            question_text: question.question_text,
            question_type: question.question_type,
            standard_code: question.standard_code,
            format,
            rewrite,
            current_dok: question.dok_level,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setPreview({
          image_url: data.image_url,
          activity_id: data.activity_id,
          activity_type: data.activity_type,
          suggested_question_text: data.suggested_question_text,
          suggested_answers: data.suggested_answers,
          suggested_dok: data.suggested_dok,
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (!preview) return;
    const result: EnhanceResult = {};

    if (format === "diagram") {
      result.image_url = preview.image_url;
      result.media = undefined;
    } else {
      result.image_url = undefined;
      result.media = {
        url: preview.image_url,
        type: "h5p",
        activity_id: preview.activity_id,
        activity_type: preview.activity_type,
      };
    }

    if (rewrite && preview.suggested_question_text) {
      result.question_text = preview.suggested_question_text;
      if (preview.suggested_answers) result.answers = preview.suggested_answers;
      if (preview.suggested_dok) result.dok_level = preview.suggested_dok;
    }

    onApply(result);
    onOpenChange(false);
  };

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Enhance Question {question.question_number}
          </DialogTitle>
          <DialogDescription>
            Add an image, drag-and-drop labels, or clickable hotspots — and optionally rewrite the question to use it.
          </DialogDescription>
          {headerExtra}
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          <div className="space-y-4">
            <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="diagram" className="gap-1.5 text-xs">
                  <ImageIcon className="h-3.5 w-3.5" /> Static Diagram
                </TabsTrigger>
                <TabsTrigger value="drag_and_drop" className="gap-1.5 text-xs">
                  <Wand2 className="h-3.5 w-3.5" /> Drag & Drop
                </TabsTrigger>
                <TabsTrigger value="image_hotspots" className="gap-1.5 text-xs">
                  <MousePointerClick className="h-3.5 w-3.5" /> Hotspots
                </TabsTrigger>
              </TabsList>

              <TabsContent value="diagram" className="text-xs text-muted-foreground mt-2">
                A clean labeled diagram. Best for showing data, structures, or processes students must analyze.
              </TabsContent>
              <TabsContent value="drag_and_drop" className="text-xs text-muted-foreground mt-2">
                A diagram with numbered blank labels. Students drag the correct term onto each numbered position.
              </TabsContent>
              <TabsContent value="image_hotspots" className="text-xs text-muted-foreground mt-2">
                A diagram with clickable hotspots. Students click each part to see its name and description.
              </TabsContent>
            </Tabs>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Image prompt {suggesting && <span className="text-muted-foreground">(suggesting...)</span>}</Label>
                {!suggesting && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={async () => {
                      setSuggesting(true);
                      try {
                        const { data } = await supabase.functions.invoke("generate-question-image", {
                          body: {
                            mode: "suggest_prompt",
                            question_text: question.question_text,
                            question_type: question.question_type,
                            standard_code: question.standard_code,
                          },
                        });
                        if (data?.suggested_prompt) setPrompt(data.suggested_prompt);
                      } finally { setSuggesting(false); }
                    }}
                  >
                    <RefreshCw className="h-3 w-3" /> Re-suggest
                  </Button>
                )}
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={suggesting ? "Drafting prompt from your question..." : "Describe what to draw..."}
                rows={4}
                className="text-sm"
                disabled={suggesting || generating}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="rewrite" className="text-sm font-medium">Also rewrite the question to use it & raise DoK</Label>
                <p className="text-xs text-muted-foreground">Updates the stem and answer choices to require analyzing the visual.</p>
              </div>
              <Switch id="rewrite" checked={rewrite} onCheckedChange={setRewrite} disabled={generating} />
            </div>

            {!preview && (
              <Button
                onClick={handleGenerate}
                disabled={generating || suggesting || !prompt.trim()}
                className="w-full gap-1.5"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Generating..." : "Generate"}
              </Button>
            )}

            {preview && (
              <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" /> Preview
                  </Label>
                  <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating} className="gap-1 text-xs">
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Try again
                  </Button>
                </div>

                <img src={preview.image_url} alt="Generated" className="w-full max-h-64 object-contain rounded-lg border bg-white" />

                {preview.activity_type && (
                  <Badge variant="outline" className="text-xs">
                    {preview.activity_type === "drag_and_drop" ? "Interactive: Drag-and-Drop labeling" : "Interactive: Click-the-part hotspots"}
                  </Badge>
                )}

                {rewrite && preview.suggested_question_text && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Rewritten question {preview.suggested_dok && <Badge variant="secondary" className="ml-2 text-[10px]">DOK → {preview.suggested_dok}</Badge>}</Label>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <p className="font-semibold text-muted-foreground">Original</p>
                        <div className="p-2 rounded border bg-background">
                          <MathText text={question.question_text.replace(/<[^>]+>/g, "")} className="text-xs" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-primary">Enhanced</p>
                        <div className="p-2 rounded border-2 border-primary/40 bg-background">
                          <MathText text={preview.suggested_question_text} className="text-xs" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleApply} disabled={!preview} className="gap-1.5">
            <Check className="h-4 w-4" /> Apply to question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
