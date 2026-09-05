import { useEffect, useState } from "react";
import { useNavigate } from "@/modules/curriculum/config/router";
import { useAuth } from "@/modules/curriculum/config/auth";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { supabase } from "@/modules/curriculum/config/supabase";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { BentoHero } from "@/modules/curriculum/config/chrome-bento-hero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookOpen, Globe, Loader2, Plus } from "lucide-react";
import type { Textbook } from "@/modules/curriculum/lib/textbook-book";

export default function Textbooks() {
  usePageTitle("Textbooks");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [books, setBooks] = useState<(Textbook & { chapter_count: number })[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", grade: "", description: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("textbooks").select("*, textbook_chapters(count)").order("updated_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setBooks((data ?? []).map((b: any) => ({ ...b, chapter_count: b.textbook_chapters?.[0]?.count ?? 0 })));
  }
  useEffect(() => { if (user) load(); }, [user]);

  async function create() {
    if (!user) return;
    if (!form.title.trim()) { toast.error("Give the book a title"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("textbooks").insert({ teacher_id: user.id, title: form.title.trim(), subject: form.subject.trim() || null, grade: form.grade.trim() || null, description: form.description.trim() || null }).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    navigate(`/app/curriculum/textbooks/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-background/90 backdrop-blur flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[{ label: "Textbooks" }]} />
      </header>
      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <BentoHero
          eyebrow="Digital textbooks"
          title={<>Compile chapters into a <em className="italic font-light">student book</em>.</>}
          subtitle="Gather textbook-format readings from your units and Library into parts and chapters, then share a link with students or send the whole book to Canvas or Google Classroom."
          stats={[{ label: "Books", value: books?.length ?? 0 }, { label: "Published", value: books?.filter((b) => b.is_published).length ?? 0 }]}
          primaryAction={{ label: "New textbook", onClick: () => setOpen(true), icon: Plus }}
          sideTiles={[
            { variant: "peach", eyebrow: "Tip", title: "Start from a subject", body: "Adding chapters \"from a subject\" turns each unit into a part and each reading into a numbered chapter." },
            { variant: "coral", eyebrow: "Students", title: "Built-in study help", body: "Every book opens with how-to-read-a-textbook tips, glossary pop-ups and self-check review questions." },
          ]}
        />

        {books === null ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          : books.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-semibold">No textbooks yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create one, then add chapters from your units or Library readings.</p>
              <Button className="mt-4 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New textbook</Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map((b) => (
                <button key={b.id} onClick={() => navigate(`/app/curriculum/textbooks/${b.id}`)} className="text-left rounded-2xl border border-border bg-card hover:shadow-md transition-shadow overflow-hidden">
                  <div className="h-28 bg-gradient-to-br from-primary/20 via-primary/5 to-accent/20 flex items-end p-4">
                    {b.cover_url ? <img src={b.cover_url} alt="" className="h-20 rounded-md shadow" /> : <BookOpen className="h-8 w-8 text-primary/60" />}
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-display text-xl leading-tight">{b.title}</h3>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <Badge variant="outline" className="font-normal">{b.chapter_count} chapter{b.chapter_count === 1 ? "" : "s"}</Badge>
                      {b.subject && <Badge variant="secondary" className="font-normal">{b.subject}</Badge>}
                      {b.grade && <Badge variant="secondary" className="font-normal">Grade {b.grade}</Badge>}
                      {b.is_published && <Badge className="font-normal gap-1"><Globe className="h-3 w-3" /> Published</Badge>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-2xl">New textbook</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Earth Science 8" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Science" /></div>
              <div className="space-y-1.5"><Label>Grade</Label><Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="8" /></div>
            </div>
            <div className="space-y-1.5"><Label>Description (optional)</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
