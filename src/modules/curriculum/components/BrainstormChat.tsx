import { useState, useRef, useEffect } from "react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Lightbulb, Send, Loader2, Trash2, ArrowRight, Target, CheckCircle, Users, StickyNote, Clock, Copy } from "lucide-react";
import { useToast } from "@/modules/curriculum/config/toast";

function renderMarkdown(text: string) {
  // Split into lines, process block-level elements
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    const cls = listType === "ol" ? "list-decimal" : "list-disc";
    elements.push(
      <Tag key={key++} className={`${cls} ml-4 space-y-0.5`}>
        {listItems.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
        ))}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    // Headers
    const h3Match = line.match(/^###\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h1Match = line.match(/^#\s+(.+)/);
    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)/);
    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)/);

    if (ulMatch) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(ulMatch[1]);
    } else if (olMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(olMatch[1]);
    } else {
      flushList();
      if (h3Match) {
        elements.push(<h4 key={key++} className="font-semibold text-sm mt-2 mb-0.5" dangerouslySetInnerHTML={{ __html: inlineMarkdown(h3Match[1]) }} />);
      } else if (h2Match) {
        elements.push(<h3 key={key++} className="font-semibold text-sm mt-2 mb-0.5" dangerouslySetInnerHTML={{ __html: inlineMarkdown(h2Match[1]) }} />);
      } else if (h1Match) {
        elements.push(<h3 key={key++} className="font-bold text-sm mt-2 mb-0.5" dangerouslySetInnerHTML={{ __html: inlineMarkdown(h1Match[1]) }} />);
      } else if (line.trim() === "") {
        elements.push(<div key={key++} className="h-1.5" />);
      } else {
        elements.push(<p key={key++} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />);
      }
    }
  }
  flushList();
  return <div className="space-y-0.5">{elements}</div>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-background/50 px-1 py-0.5 rounded text-xs font-mono">$1</code>');
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LessonContext {
  title: string;
  objectives: string;
  standards: string;
  duration: number;
}

export type LessonField = "objectives" | "assessment" | "differentiation" | "notes" | "activities";

const FIELD_OPTIONS: { field: LessonField; label: string; icon: React.ElementType }[] = [
  { field: "objectives", label: "Objectives", icon: Target },
  { field: "activities", label: "Activities", icon: Clock },
  { field: "assessment", label: "Assessment", icon: CheckCircle },
  { field: "differentiation", label: "Differentiation", icon: Users },
  { field: "notes", label: "Notes", icon: StickyNote },
];

interface Props {
  lessonContext: LessonContext;
  onCopyToField?: (field: LessonField, content: string) => void;
}

const QUICK_PROMPTS = [
  "Unpack this standard: explain the science, real-life applications, and misconceptions",
  "Help me find resources for this lesson",
  "Give me 5 creative checking-for-understanding strategies for this lesson",
  "Suggest a hands-on lab activity for this topic",
  "Create an engaging warm-up/hook for this lesson",
  "Design an exit ticket with 3 questions",
  "Suggest differentiation strategies for struggling readers",
];

export function BrainstormChat({ lessonContext, onCopyToField }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("You must be signed in to use brainstorming");
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lesson-brainstorm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: newMessages,
            lessonContext,
          }),
        }
      );

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      console.error("Brainstorm error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message || "Something went wrong. Please try again."}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
          <Lightbulb className="h-4 w-4" />
          Brainstorm
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Lightbulb className="h-4 w-4 text-primary" />
              Lesson Brainstorm
            </SheetTitle>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground" onClick={() => setMessages([])}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">AI assistant for activity ideas, CFU strategies, and lesson planning</p>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Quick prompts:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-accent/70 hover:bg-accent text-foreground transition-colors text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                  : "bg-accent/70 text-foreground"
              }`}>
                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                {msg.role === "assistant" && msg.content && !isLoading && (
                  <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        toast({ title: "Copied to clipboard" });
                      }}
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                    {onCopyToField && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                          >
                            <ArrowRight className="h-3 w-3" /> Send to field
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-[160px]">
                          {FIELD_OPTIONS.map(({ field, label, icon: Icon }) => (
                            <DropdownMenuItem
                              key={field}
                              onClick={() => {
                                onCopyToField(field, msg.content);
                                toast({ title: `Added to ${label}` });
                              }}
                              className="gap-2 text-xs"
                            >
                              <Icon className="h-3.5 w-3.5" /> {label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-accent/70 rounded-xl px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border/60">
          <div className="flex gap-2">
            <Textarea
              placeholder="Ask about activities, CFU ideas, lesson concepts..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="text-sm resize-none"
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="h-auto rounded-xl shrink-0"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
