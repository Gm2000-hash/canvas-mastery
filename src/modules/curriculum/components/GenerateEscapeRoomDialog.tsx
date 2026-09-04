import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, Lock, Key, Copy, ChevronDown, ChevronUp, Lightbulb, FileText, FileDown, BookOpen, FlaskConical, ListOrdered, ArrowRight, Pencil, Check, Plus, X } from "lucide-react";
import { useToast } from "@/modules/curriculum/config/toast";
import { supabase } from "@/modules/curriculum/config/supabase";
import { readEdgeError } from "@/lib/edgeError";
import { exportEscapeRoomToDocx } from "@/modules/curriculum/lib/export-escape-room-docx";
import { useAiPreferences } from "@/modules/curriculum/hooks/useAiPreferences";

interface Puzzle {
  room_number: number;
  room_name: string;
  narrative_text: string;
  scenario_text?: string;
  challenge_steps?: string[];
  story_transition?: string;
  puzzle_type: string;
  question_text: string;
  hints: string[];
  lock_code: string;
  lock_code_explanation: string;
  form_section_instructions: string;
  distractors: string[];
}

interface EscapeRoom {
  theme_title: string;
  narrative_intro: string;
  google_form_setup: string;
  puzzles: Puzzle[];
  answer_key_summary: string;
  estimated_time_minutes: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: {
    title?: string;
    topic?: string;
    gradeLevel?: string;
    discipline?: string;
    objectives?: string;
    vocabulary?: string;
  };
}

const PUZZLE_TYPE_LABELS: Record<string, string> = {
  decode: "🔢 Decode",
  matching: "🔗 Matching",
  diagram: "🖼️ Diagram",
  vocabulary: "📖 Vocabulary",
  data: "📊 Data",
  riddle: "🧩 Riddle",
};

export function GenerateEscapeRoomDialog({ open, onOpenChange, context }: Props) {
  const { toast } = useToast();
  const [topic, setTopic] = useState(context?.topic || context?.title || "");
  const [numPuzzles, setNumPuzzles] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [escapeRoom, setEscapeRoom] = useState<EscapeRoom | null>(null);
  const [expandedPuzzle, setExpandedPuzzle] = useState<number | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [editingRoom, setEditingRoom] = useState<number | null>(null);
  const modelOverride = "";
  const { preferences } = useAiPreferences();

  const updatePuzzleField = (roomNumber: number, field: keyof Puzzle, value: any) => {
    if (!escapeRoom) return;
    setEscapeRoom({
      ...escapeRoom,
      puzzles: escapeRoom.puzzles.map(p =>
        p.room_number === roomNumber ? { ...p, [field]: value } : p
      ),
    });
  };

  const updateChallengeStep = (roomNumber: number, stepIndex: number, value: string) => {
    if (!escapeRoom) return;
    setEscapeRoom({
      ...escapeRoom,
      puzzles: escapeRoom.puzzles.map(p => {
        if (p.room_number !== roomNumber) return p;
        const steps = [...(p.challenge_steps || [])];
        steps[stepIndex] = value;
        return { ...p, challenge_steps: steps };
      }),
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(15);
    setEscapeRoom(null);

    try {
      setProgress(25);
      const { data, error } = await supabase.functions.invoke("generate-escape-room", {
        body: {
          title: context?.title || topic,
          topic: topic || context?.title,
          gradeLevel: context?.gradeLevel || "Middle School",
          discipline: context?.discipline || "Science",
          objectives: context?.objectives || "",
          vocabulary: context?.vocabulary || "",
          numPuzzles,
          difficulty,
          additionalContext,
          ...(modelOverride ? { model_override: modelOverride } : {}),
          ai_preferences: preferences,
        },
      });

      setProgress(90);

      if (error) throw new Error(await readEdgeError(error, "Generation failed"));
      if (!data?.puzzles) throw new Error("Invalid response from AI");

      setEscapeRoom(data);
      setProgress(100);
      toast({ title: "Escape room generated!" });
    } catch (err: any) {
      console.error("Escape room generation error:", err);
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const copyFullEscapeRoom = () => {
    if (!escapeRoom) return;
    let text = `# ${escapeRoom.theme_title}\n\n`;
    text += `**Estimated Time:** ${escapeRoom.estimated_time_minutes} minutes\n\n`;
    text += `## Introduction\n${escapeRoom.narrative_intro}\n\n`;
    text += `## Google Form Setup Instructions\n${escapeRoom.google_form_setup}\n\n`;
    escapeRoom.puzzles.forEach((p) => {
      text += `---\n## Room ${p.room_number}: ${p.room_name}\n`;
      text += `**Type:** ${p.puzzle_type}\n\n`;
      text += `### Story\n${p.narrative_text}\n\n`;
      if (p.scenario_text) text += `### Scientific Scenario\n${p.scenario_text}\n\n`;
      if (p.challenge_steps?.length) {
        text += `### Challenge Steps\n`;
        p.challenge_steps.forEach((s, i) => { text += `**Step ${i + 1}:** ${s}\n\n`; });
      }
      if (p.question_text) text += `### Puzzle Question\n${p.question_text}\n\n`;
      if (p.distractors?.length > 0) {
        text += `**Options:** ${p.distractors.join(", ")}, ${p.lock_code}\n\n`;
      }
      text += `**Lock Code:** ${p.lock_code}\n`;
      text += `**Explanation:** ${p.lock_code_explanation}\n\n`;
      text += `**Hints:**\n${p.hints.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\n`;
      if (p.story_transition) text += `### Story Transition\n${p.story_transition}\n\n`;
      text += `**Form Setup:** ${p.form_section_instructions}\n\n`;
    });
    text += `---\n## Answer Key\n${escapeRoom.answer_key_summary}\n`;
    copyToClipboard(text, "Full escape room");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Escape Room Generator
          </DialogTitle>
        </DialogHeader>

        {!escapeRoom ? (
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-accent/50 text-sm">
              <p className="text-muted-foreground">
                Generate a digital escape room with <span className="font-medium text-foreground">detailed scenarios, multi-step challenges, and a continuous storyline</span> designed for Google Forms.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Topic / Focus Area</Label>
              <Input placeholder="e.g. Cell Division & Mitosis" value={topic} onChange={e => setTopic(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Number of Rooms</Label>
                <Input type="number" min={3} max={10} value={numPuzzles} onChange={e => setNumPuzzles(parseInt(e.target.value) || 5)} />
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Additional Instructions (optional)</Label>
              <Textarea
                placeholder="e.g. Include vocabulary from Chapter 5, focus on mitosis vs meiosis..."
                value={additionalContext}
                onChange={e => setAdditionalContext(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">UDL-aligned</span><span>Multiple solution paths and accessibility cues built in.</span></div>
            </div>
            {generating && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Crafting detailed scenarios & storyline — this may take a minute...
                </p>
              </div>
            )}
            <Button onClick={handleGenerate} className="w-full rounded-xl gap-2" disabled={generating || !topic.trim()}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating..." : `Generate ${numPuzzles}-Room Escape Room`}
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-4">
              {/* Header */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{escapeRoom.theme_title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{escapeRoom.narrative_intro}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">~{escapeRoom.estimated_time_minutes} min</Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5 flex-1" onClick={copyFullEscapeRoom}>
                  <Copy className="h-3.5 w-3.5" /> Copy All
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5 flex-1" onClick={() => setShowSetup(!showSetup)}>
                  <FileText className="h-3.5 w-3.5" /> {showSetup ? "Hide" : "Show"} Setup Guide
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5 flex-1">
                      <FileDown className="h-3.5 w-3.5" /> Export Word
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportEscapeRoomToDocx(escapeRoom, "both")}>
                      📄 Full Document (Student + Teacher)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportEscapeRoomToDocx(escapeRoom, "student")}>
                      📝 Student Version Only
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportEscapeRoomToDocx(escapeRoom, "teacher")}>
                      🗝️ Teacher Answer Key Only
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Setup Guide */}
              {showSetup && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Google Form Setup Instructions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{escapeRoom.google_form_setup}</p>
                    <Button size="sm" variant="ghost" className="mt-2 gap-1.5 text-xs" onClick={() => copyToClipboard(escapeRoom.google_form_setup, "Setup instructions")}>
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Puzzles */}
              {escapeRoom.puzzles.map((puzzle) => (
                <Card key={puzzle.room_number} className="overflow-hidden">
                  <button
                    className="w-full p-4 flex items-center gap-3 text-left hover:bg-accent/30 transition-colors"
                    onClick={() => setExpandedPuzzle(expandedPuzzle === puzzle.room_number ? null : puzzle.room_number)}
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {puzzle.room_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground text-sm">{puzzle.room_name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">{PUZZLE_TYPE_LABELS[puzzle.puzzle_type] || puzzle.puzzle_type}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Key className="h-3 w-3" /> {puzzle.lock_code}</span>
                      </div>
                    </div>
                    {expandedPuzzle === puzzle.room_number ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {expandedPuzzle === puzzle.room_number && (
                    <div className="px-4 pb-4 space-y-4 border-t border-border/60 pt-3">
                      {/* Edit toggle */}
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant={editingRoom === puzzle.room_number ? "default" : "outline"}
                          className="gap-1.5 text-xs rounded-xl"
                          onClick={() => setEditingRoom(editingRoom === puzzle.room_number ? null : puzzle.room_number)}
                        >
                          {editingRoom === puzzle.room_number ? <><Check className="h-3 w-3" /> Done Editing</> : <><Pencil className="h-3 w-3" /> Edit Room</>}
                        </Button>
                      </div>

                      {/* Narrative */}
                      <div className="p-3 rounded-lg bg-accent/30 border border-accent/50">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" /> Story
                        </p>
                        {editingRoom === puzzle.room_number ? (
                          <Textarea value={puzzle.narrative_text} onChange={e => updatePuzzleField(puzzle.room_number, "narrative_text", e.target.value)} className="text-sm min-h-[120px] bg-background" />
                        ) : (
                          <p className="text-sm text-foreground leading-relaxed">{puzzle.narrative_text}</p>
                        )}
                      </div>

                      {/* Scientific Scenario */}
                      {(puzzle.scenario_text || editingRoom === puzzle.room_number) && (
                        <div className="p-3 rounded-lg bg-info/5 border border-info/20">
                          <p className="text-xs font-medium text-info uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                            <FlaskConical className="h-3.5 w-3.5" /> Scientific Scenario
                          </p>
                          {editingRoom === puzzle.room_number ? (
                            <Textarea value={puzzle.scenario_text || ""} onChange={e => updatePuzzleField(puzzle.room_number, "scenario_text", e.target.value)} className="text-sm min-h-[100px] bg-background" />
                          ) : (
                            <p className="text-sm text-foreground leading-relaxed">{puzzle.scenario_text}</p>
                          )}
                        </div>
                      )}

                      {/* Challenge Steps */}
                      {(puzzle.challenge_steps?.length || editingRoom === puzzle.room_number) ? (
                        <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                          <p className="text-xs font-medium text-warning uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <ListOrdered className="h-3.5 w-3.5" /> Challenge Steps
                          </p>
                          <div className="space-y-2.5">
                            {(puzzle.challenge_steps || []).map((step, i) => (
                              <div key={i} className="flex gap-2.5">
                                <div className="h-6 w-6 rounded-full bg-warning/15 flex items-center justify-center text-xs font-bold text-warning shrink-0 mt-0.5">
                                  {i + 1}
                                </div>
                                {editingRoom === puzzle.room_number ? (
                                  <div className="flex-1 flex gap-1.5">
                                    <Textarea value={step} onChange={e => updateChallengeStep(puzzle.room_number, i, e.target.value)} className="text-sm min-h-[60px] bg-background flex-1" />
                                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 mt-0.5 text-muted-foreground hover:text-destructive" onClick={() => {
                                      const steps = [...(puzzle.challenge_steps || [])];
                                      steps.splice(i, 1);
                                      updatePuzzleField(puzzle.room_number, "challenge_steps", steps);
                                    }}><X className="h-3.5 w-3.5" /></Button>
                                  </div>
                                ) : (
                                  <p className="text-sm text-foreground leading-relaxed">{step}</p>
                                )}
                              </div>
                            ))}
                            {editingRoom === puzzle.room_number && (
                              <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-warning" onClick={() => {
                                updatePuzzleField(puzzle.room_number, "challenge_steps", [...(puzzle.challenge_steps || []), ""]);
                              }}><Plus className="h-3 w-3" /> Add Step</Button>
                            )}
                          </div>
                        </div>
                      ) : null}

                      {/* Legacy question_text fallback */}
                      {!puzzle.challenge_steps?.length && puzzle.question_text && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Puzzle</p>
                          {editingRoom === puzzle.room_number ? (
                            <Textarea value={puzzle.question_text} onChange={e => updatePuzzleField(puzzle.room_number, "question_text", e.target.value)} className="text-sm min-h-[60px] bg-background" />
                          ) : (
                            <p className="text-sm text-foreground">{puzzle.question_text}</p>
                          )}
                        </div>
                      )}

                      {/* Answer Options */}
                      {puzzle.distractors?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Answer Options</p>
                          <div className="flex flex-wrap gap-1.5">
                            {[...puzzle.distractors, puzzle.lock_code].sort().map((opt, i) => (
                              <Badge key={i} variant={opt === puzzle.lock_code ? "default" : "outline"} className="text-xs">
                                {opt} {opt === puzzle.lock_code ? "✓" : ""}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lock Code */}
                      <div className="p-2.5 rounded-lg bg-accent/50">
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Key className="h-3 w-3" /> Lock Code & Explanation</p>
                        {editingRoom === puzzle.room_number ? (
                          <div className="space-y-2">
                            <div className="flex gap-2 items-center">
                              <Label className="text-xs shrink-0">Code:</Label>
                              <Input value={puzzle.lock_code} onChange={e => updatePuzzleField(puzzle.room_number, "lock_code", e.target.value)} className="h-8 text-sm" />
                            </div>
                            <Textarea value={puzzle.lock_code_explanation} onChange={e => updatePuzzleField(puzzle.room_number, "lock_code_explanation", e.target.value)} className="text-sm min-h-[60px] bg-background" placeholder="Explanation..." />
                          </div>
                        ) : (
                          <p className="text-sm"><span className="font-bold text-primary">{puzzle.lock_code}</span> — {puzzle.lock_code_explanation}</p>
                        )}
                      </div>

                      {/* Hints */}
                      {(puzzle.hints?.length > 0 || editingRoom === puzzle.room_number) && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Hints</p>
                          {editingRoom === puzzle.room_number ? (
                            <div className="space-y-1.5">
                              {(puzzle.hints || []).map((h, i) => (
                                <div key={i} className="flex gap-1.5 items-center">
                                  <Input value={h} onChange={e => { const hints = [...(puzzle.hints || [])]; hints[i] = e.target.value; updatePuzzleField(puzzle.room_number, "hints", hints); }} className="h-8 text-sm flex-1" placeholder={`Hint ${i + 1}`} />
                                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => {
                                    const hints = [...(puzzle.hints || [])];
                                    hints.splice(i, 1);
                                    updatePuzzleField(puzzle.room_number, "hints", hints);
                                  }}><X className="h-3.5 w-3.5" /></Button>
                                </div>
                              ))}
                              <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => {
                                updatePuzzleField(puzzle.room_number, "hints", [...(puzzle.hints || []), ""]);
                              }}><Plus className="h-3 w-3" /> Add Hint</Button>
                            </div>
                          ) : (
                            <ol className="list-decimal list-inside text-sm space-y-0.5">
                              {puzzle.hints.map((h, i) => <li key={i} className="text-muted-foreground">{h}</li>)}
                            </ol>
                          )}
                        </div>
                      )}

                      {/* Story Transition */}
                      {(puzzle.story_transition || editingRoom === puzzle.room_number) && (
                        <div className="p-2.5 rounded-lg bg-success/5 border border-success/20">
                          <p className="text-xs font-medium text-success uppercase tracking-wide mb-1 flex items-center gap-1.5">
                            <ArrowRight className="h-3 w-3" /> What Happens Next
                          </p>
                          {editingRoom === puzzle.room_number ? (
                            <Textarea value={puzzle.story_transition || ""} onChange={e => updatePuzzleField(puzzle.room_number, "story_transition", e.target.value)} className="text-sm min-h-[60px] bg-background" />
                          ) : (
                            <p className="text-sm text-foreground italic">{puzzle.story_transition}</p>
                          )}
                        </div>
                      )}

                      {/* Form Setup */}
                      <div className="p-2.5 rounded-lg bg-muted/50">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Google Form Setup</p>
                        <p className="text-xs text-muted-foreground">{puzzle.form_section_instructions}</p>
                      </div>

                      <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => {
                        let text = `Room ${puzzle.room_number}: ${puzzle.room_name}\n\n`;
                        text += `STORY:\n${puzzle.narrative_text}\n\n`;
                        if (puzzle.scenario_text) text += `SCENARIO:\n${puzzle.scenario_text}\n\n`;
                        if (puzzle.challenge_steps?.length) {
                          text += `CHALLENGE:\n`;
                          puzzle.challenge_steps.forEach((s, i) => { text += `Step ${i + 1}: ${s}\n`; });
                          text += `\n`;
                        }
                        text += `Answer: ${puzzle.lock_code}\n`;
                        if (puzzle.story_transition) text += `\nTRANSITION: ${puzzle.story_transition}\n`;
                        text += `\nForm Setup: ${puzzle.form_section_instructions}`;
                        copyToClipboard(text, `Room ${puzzle.room_number}`);
                      }}>
                        <Copy className="h-3 w-3" /> Copy This Room
                      </Button>
                    </div>
                  )}
                </Card>
              ))}

              {/* Answer Key */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> Answer Key</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{escapeRoom.answer_key_summary}</p>
                </CardContent>
              </Card>

              {/* Generate Another */}
              <Button variant="outline" className="w-full rounded-xl gap-2" onClick={() => setEscapeRoom(null)}>
                <Sparkles className="h-4 w-4" /> Generate Another
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
