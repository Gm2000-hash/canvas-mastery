import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Link2, Upload, Trash2 } from "lucide-react";
import { FRAMEWORKS, STATES, SUBJECTS, GRADES, type FrameworkId, getFramework } from "@/lib/frameworks";

type ParsedStandard = { code: string; description: string; selected: boolean };

export default function ImportStandardsDialog({
  open,
  onClose,
  onImported,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
  defaults?: { framework?: FrameworkId; state?: string; subject?: string; grade?: string };
}) {
  const [mode, setMode] = useState<"url" | "pdf">("url");
  const [url, setUrl] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string>("");
  const [pdfName, setPdfName] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [framework, setFramework] = useState<FrameworkId>(defaults?.framework ?? "CUSTOM");
  const [state, setState] = useState(defaults?.state ?? "");
  const [subject, setSubject] = useState(defaults?.subject ?? "");
  const [grade, setGrade] = useState(defaults?.grade ?? "");

  const [extracting, setExtracting] = useState(false);
  const [parsed, setParsed] = useState<ParsedStandard[] | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setMode("url"); setUrl(""); setPdfBase64(""); setPdfName("");
    setParsed(null); setExtracting(false); setSaving(false);
  }

  async function onPickFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Please choose a PDF file");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("PDF too large (max 12 MB)");
      return;
    }
    setPdfName(file.name);
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
    }
    setPdfBase64(btoa(binary));
  }

  async function extract() {
    if (!subject || !grade) { toast.error("Pick subject and grade so saved standards are tagged correctly"); return; }
    if (mode === "url" && !url.trim()) { toast.error("Paste a URL"); return; }
    if (mode === "pdf" && !pdfBase64) { toast.error("Choose a PDF"); return; }

    setExtracting(true);
    setParsed(null);
    const { data, error } = await supabase.functions.invoke("import-standards", {
      body: {
        url: mode === "url" ? url.trim() : undefined,
        pdfBase64: mode === "pdf" ? pdfBase64 : undefined,
        fileName: mode === "pdf" ? pdfName : undefined,
        framework, state, subject, grade,
      },
    });
    setExtracting(false);
    if (error) { toast.error((error as any).message ?? "Extraction failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const list: Array<{ code: string; description: string }> = (data as any).standards ?? [];
    if (list.length === 0) { toast.error("No standards found in that source."); return; }
    setParsed(list.map((s) => ({ ...s, selected: true })));
    toast.success(`Found ${list.length} standards — review and confirm.`);
  }

  function updateRow(idx: number, patch: Partial<ParsedStandard>) {
    setParsed((prev) => prev ? prev.map((r, i) => i === idx ? { ...r, ...patch } : r) : prev);
  }
  function removeRow(idx: number) {
    setParsed((prev) => prev ? prev.filter((_, i) => i !== idx) : prev);
  }

  async function save() {
    if (!parsed) return;
    const chosen = parsed.filter((r) => r.selected && r.code.trim() && r.description.trim());
    if (chosen.length === 0) { toast.error("Select at least one standard to save"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Not signed in"); return; }
    setSaving(true);
    const rows = chosen.map((r) => ({
      teacher_id: u.user!.id,
      code: r.code.trim().slice(0, 80),
      description: r.description.trim().slice(0, 1000),
      state: state || "",
      subject,
      grade,
      framework,
    }));
    const { error } = await supabase.from("standards").insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${rows.length} standards into your library.`);
    onImported?.();
    reset();
    onClose();
  }

  const fwMeta = getFramework(framework);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import standards from a website or PDF</DialogTitle>
          <DialogDescription>
            Paste a URL or upload an official standards document. We'll extract every standard we find — you can review and edit before saving them to your library.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <div className="space-y-4">
            {/* Source toggle */}
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === "url" ? "default" : "outline"} onClick={() => setMode("url")}>
                <Link2 className="h-3.5 w-3.5 mr-1" /> URL
              </Button>
              <Button type="button" size="sm" variant={mode === "pdf" ? "default" : "outline"} onClick={() => setMode("pdf")}>
                <Upload className="h-3.5 w-3.5 mr-1" /> PDF upload
              </Button>
            </div>

            {mode === "url" ? (
              <div className="space-y-2">
                <Label className="text-xs">Standards page or PDF URL</Label>
                <Input
                  placeholder="https://www.sde.idaho.gov/.../Standards.pdf"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Works on plain webpages and direct PDF links. Login-protected pages won't work — download the PDF and upload it.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">PDF file (max 12 MB)</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }}
                />
                {pdfName && <p className="text-xs text-muted-foreground">Selected: {pdfName}</p>}
              </div>
            )}

            {/* Tagging */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">Framework</Label>
                <Select value={framework} onValueChange={(v) => setFramework(v as FrameworkId)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FRAMEWORKS.map((f) => <SelectItem key={f.id} value={f.id}>{f.shortLabel}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State {fwMeta.national && <span className="text-muted-foreground">(opt)</span>}</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Grade</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground rounded-md bg-muted/40 p-2 border">
              These standards will be saved to <strong>your private library</strong> (not shared with other teachers). You can edit them later on the Standards page.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>
                <strong>{parsed.filter((r) => r.selected).length}</strong> of {parsed.length} selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setParsed(parsed.map((r) => ({ ...r, selected: true })))}>Select all</Button>
                <Button size="sm" variant="ghost" onClick={() => setParsed(parsed.map((r) => ({ ...r, selected: false })))}>Clear</Button>
              </div>
            </div>
            <div className="border rounded-md divide-y max-h-[50vh] overflow-y-auto">
              {parsed.map((row, i) => (
                <div key={i} className="flex items-start gap-2 p-2">
                  <Checkbox checked={row.selected} onCheckedChange={(v) => updateRow(i, { selected: !!v })} className="mt-2" />
                  <Input
                    className="w-40 font-code text-xs"
                    value={row.code}
                    onChange={(e) => updateRow(i, { code: e.target.value })}
                  />
                  <Textarea
                    className="flex-1 text-xs min-h-[2.25rem]"
                    rows={2}
                    value={row.description}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeRow(i)} title="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {!parsed ? (
            <>
              <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
              <Button onClick={extract} disabled={extracting}>
                {extracting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Extract standards
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setParsed(null)}>Back</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save to my library
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
