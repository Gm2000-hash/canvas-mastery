import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, FileText, FolderInput, MoreHorizontal, Pencil, Sparkles, Trash2, Upload, Link2 } from "lucide-react";
import { SECTIONS, SOURCE_LABEL, dokLabel, dokName, type LibraryItem, type LibraryKind } from "./libraryTypes";

export async function downloadItemFile(it: LibraryItem) {
  if (!it.file_path) return;
  const { data, error } = await supabase.storage.from("library-files").createSignedUrl(it.file_path, 300, { download: it.file_name ?? undefined });
  if (error || !data?.signedUrl) { toast.error("Could not open file"); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

function SourceIcon({ source }: { source: LibraryItem["source"] }) {
  const cls = "h-3 w-3";
  if (source === "ai") return <Sparkles className={cls} />;
  if (source === "upload") return <Upload className={cls} />;
  if (source === "canvas") return <Link2 className={cls} />;
  return <Pencil className={cls} />;
}

export function LibraryItemCard({ item, onEdit, onChanged }: {
  item: LibraryItem;
  onEdit: (it: LibraryItem) => void;
  onChanged: () => void;
}) {
  const [viewing, setViewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function remove() {
    if (item.file_path) await supabase.storage.from("library-files").remove([item.file_path]);
    const { error } = await supabase.from("library_items").delete().eq("id", item.id);
    if (error) toast.error(error.message); else { toast.success("Removed"); onChanged(); }
  }

  async function refile(kind: LibraryKind) {
    const { error } = await supabase.from("library_items").update({ kind }).eq("id", item.id);
    if (error) toast.error(error.message); else { toast.success(`Moved to ${SECTIONS.find((s) => s.key === kind)?.label}`); onChanged(); }
  }

  const snippet = (item.body ?? "").replace(/[#*_>`]/g, "").slice(0, 180);

  return (
    <>
      <Card className="group hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewing(true)}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-sans font-semibold text-base leading-snug line-clamp-2">{item.title}</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100" aria-label="Item actions"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onEdit(item)}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                {item.file_path && <DropdownMenuItem onClick={() => downloadItemFile(item)}><Download className="h-4 w-4 mr-2" /> Download file</DropdownMenuItem>}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderInput className="h-4 w-4 mr-2" /> Move to…</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {SECTIONS.filter((s) => s.key !== "question" && s.key !== item.kind).map((s) => (
                      <DropdownMenuItem key={s.key} onClick={() => refile(s.key as LibraryKind)}>{s.label}</DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {snippet ? <p className="text-sm text-muted-foreground line-clamp-2 font-sans">{snippet}</p>
            : item.file_name ? <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-sans"><FileText className="h-3.5 w-3.5" /> {item.file_name}</p> : null}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge variant="outline" className="gap-1 text-[11px] font-normal"><SourceIcon source={item.source} /> {SOURCE_LABEL[item.source]}</Badge>
            {item.grade && <Badge variant="outline" className="text-[11px] font-normal">Gr {item.grade}</Badge>}
            {dokLabel(item.dok_levels) && <Badge variant="outline" className="text-[11px] font-normal bg-primary/5 border-primary/30 text-primary">{dokLabel(item.dok_levels)}</Badge>}
            {item.standards.slice(0, 3).map((s) => <Badge key={s.id} variant="secondary" className="text-[11px] font-normal">{s.code}</Badge>)}
            {item.standards.length > 3 && <span className="text-[11px] text-muted-foreground">+{item.standards.length - 3}</span>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={viewing} onOpenChange={setViewing}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{item.title}</DialogTitle>
            <DialogDescription className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline" className="gap-1 text-[11px] font-normal"><SourceIcon source={item.source} /> {SOURCE_LABEL[item.source]}</Badge>
              {(item.dok_levels ?? []).map((l) => <Badge key={l} variant="outline" className="text-[11px] font-normal bg-primary/5 border-primary/30 text-primary">DOK {l} · {dokName(l)}</Badge>)}
              {item.standards.map((s) => <Badge key={s.id} variant="secondary" className="text-[11px] font-normal" title={s.description}>{s.code}</Badge>)}
            </DialogDescription>
          </DialogHeader>
          {item.file_path && (
            <Button variant="outline" size="sm" className="w-fit" onClick={() => downloadItemFile(item)}>
              <Download className="h-4 w-4 mr-1.5" /> Open {item.file_name ?? "file"}
            </Button>
          )}
          {item.body ? (
            <div className="prose prose-sm max-w-none font-sans">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body}</ReactMarkdown>
            </div>
          ) : !item.file_path ? <p className="text-sm text-muted-foreground">No content yet.</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setViewing(false); onEdit(item); }}><Pencil className="h-4 w-4 mr-1.5" /> Edit</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{item.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This removes it from your library{item.file_path ? " and deletes the attached file" : ""}. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
