import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";
import { useGoogleConnection } from "@/modules/curriculum/config/google-connection";
import { useNavigate } from "@/modules/curriculum/config/router";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with imported { title, html } when user confirms. */
  onImported: (result: { title: string; html: string }) => void | Promise<void>;
  /** Customize header copy. */
  title?: string;
  description?: string;
}

export default function GoogleImportDialog({
  open,
  onOpenChange,
  onImported,
  title = "Import from Google Doc",
  description = "Paste a Google Doc link. Content will be imported using your connected Google account.",
}: Props) {
  const { status } = useGoogleConnection();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!status?.connected) {
      toast.error("Connect Google first (Settings → Google).");
      navigate("/app/settings");
      return;
    }
    if (!url.trim()) {
      toast.error("Paste a Google Doc URL");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-import-doc", {
        body: { url: url.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await onImported({ title: (data as any).title, html: (data as any).html });
      toast.success("Imported from Google Doc");
      setUrl("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[150]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            placeholder="https://docs.google.com/document/d/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          {!status?.connected && (
            <p className="text-xs text-muted-foreground">
              Your Google account isn't connected yet — you'll be sent to Settings.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
