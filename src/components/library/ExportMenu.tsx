// Reusable export controls. `useExportActions` owns the download + LMS
// dialog logic; `ExportMenuItems` renders the choices inside any dropdown, and
// `ExportButton` is a self-contained "Export ▾" button for bulk bars.
//
// Destinations: Word / PDF / Excel downloads, Canvas, and Google Classroom —
// all rendered from the same ExportResource model.
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowRightLeft, ChevronDown, FileSpreadsheet, FileText, FileType2, GraduationCap, Loader2, Send } from "lucide-react";
import type { ExportResource } from "@/lib/export/resource";
import { PushToCanvasDialog } from "./PushToCanvasDialog";
import { PushToGoogleClassroomDialog } from "./PushToGoogleClassroomDialog";

export type ExportFormat = "docx" | "pdf" | "xlsx" | "canvas" | "google";
type Source = ExportResource[] | (() => ExportResource[] | Promise<ExportResource[]>);

export function useExportActions(source: Source) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [canvas, setCanvas] = useState<ExportResource[] | null>(null);
  const [google, setGoogle] = useState<ExportResource[] | null>(null);

  async function resolve(): Promise<ExportResource[]> {
    const r = typeof source === "function" ? await source() : source;
    if (!r.length) toast.error("Nothing selected to export");
    return r;
  }

  async function run(fmt: ExportFormat) {
    setBusy(fmt);
    try {
      const resources = await resolve();
      if (!resources.length) return;
      if (fmt === "canvas") { setCanvas(resources); return; }
      if (fmt === "google") { setGoogle(resources); return; }
      if (fmt === "docx") { const { exportResourcesDocx } = await import("@/lib/export/docx"); await exportResourcesDocx(resources); }
      if (fmt === "pdf") { const { exportResourcesPdf } = await import("@/lib/export/pdf"); await exportResourcesPdf(resources); }
      if (fmt === "xlsx") { const { exportResourcesXlsx } = await import("@/lib/export/xlsx"); await exportResourcesXlsx(resources); }
      toast.success("Download started");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(null);
    }
  }

  const dialog: ReactNode = (
    <>
      <PushToCanvasDialog open={!!canvas} resources={canvas ?? []} onClose={() => setCanvas(null)} />
      <PushToGoogleClassroomDialog open={!!google} resources={google ?? []} onClose={() => setGoogle(null)} />
    </>
  );
  return { run, busy, dialog };
}

/**
 * `suggest` pre-selects the opposite platform for a resource that came from
 * Canvas or Google, surfacing a one-click "Convert to …" entry at the top.
 */
export function ExportMenuItems({ run, busy, suggest }: { run: (f: ExportFormat) => void; busy: ExportFormat | null; suggest?: "canvas" | "google" | null }) {
  const Icon = ({ f, children }: { f: ExportFormat; children: ReactNode }) => busy === f ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <>{children}</>;
  return (
    <>
      {suggest && (
        <>
          <DropdownMenuItem onClick={() => run(suggest)} className="font-medium">
            <Icon f={suggest}><ArrowRightLeft className="h-4 w-4 mr-2" /></Icon> Convert to {suggest === "canvas" ? "Canvas" : "Google Classroom"}…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem onClick={() => run("docx")}><Icon f="docx"><FileText className="h-4 w-4 mr-2" /></Icon> Word (.docx)</DropdownMenuItem>
      <DropdownMenuItem onClick={() => run("pdf")}><Icon f="pdf"><FileType2 className="h-4 w-4 mr-2" /></Icon> PDF</DropdownMenuItem>
      <DropdownMenuItem onClick={() => run("xlsx")}><Icon f="xlsx"><FileSpreadsheet className="h-4 w-4 mr-2" /></Icon> Excel (.xlsx)</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => run("canvas")}><Icon f="canvas"><Send className="h-4 w-4 mr-2" /></Icon> Send to Canvas…</DropdownMenuItem>
      <DropdownMenuItem onClick={() => run("google")}><Icon f="google"><GraduationCap className="h-4 w-4 mr-2" /></Icon> Send to Google Classroom…</DropdownMenuItem>
    </>
  );
}

export function ExportButton({ source, label = "Export", size = "sm", variant = "outline", disabled }: {
  source: Source; label?: string; size?: "sm" | "default"; variant?: "outline" | "default" | "secondary" | "ghost"; disabled?: boolean;
}) {
  const { run, busy, dialog } = useExportActions(source);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} disabled={disabled || !!busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}{label} <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end"><ExportMenuItems run={run} busy={busy} /></DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </>
  );
}
