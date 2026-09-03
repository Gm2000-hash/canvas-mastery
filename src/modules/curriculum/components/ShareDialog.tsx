import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useToggleShareNote } from "@/modules/curriculum/hooks/useNotes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  isPublic: boolean;
  shareToken: string | null;
}

export function ShareDialog({ open, onOpenChange, noteId, isPublic, shareToken }: Props) {
  const [copied, setCopied] = useState(false);
  const [localPublic, setLocalPublic] = useState(isPublic);
  const [localToken, setLocalToken] = useState<string | null>(shareToken);
  const toggle = useToggleShareNote();

  useEffect(() => {
    setLocalPublic(isPublic);
    setLocalToken(shareToken);
  }, [isPublic, shareToken, open]);

  const url = localToken ? `${window.location.origin}/curriculum/share/${localToken}` : "";

  const handleToggle = async (next: boolean) => {
    setLocalPublic(next);
    try {
      const updated = await toggle.mutateAsync({ id: noteId, makePublic: next, currentToken: localToken });
      setLocalToken(updated.share_token);
      toast.success(next ? "Page is now public" : "Page is now private");
    } catch (e: any) {
      setLocalPublic(!next);
      toast.error(e.message ?? "Could not update");
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Share this page
          </DialogTitle>
          <DialogDescription>
            Anyone with the link will be able to view this page. They won't be able to edit it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <Label className="text-sm font-medium">Public access</Label>
              <p className="text-xs text-muted-foreground">Share with anyone via link</p>
            </div>
            <Switch checked={localPublic} onCheckedChange={handleToggle} disabled={toggle.isPending} />
          </div>
          {localPublic && url && (
            <div className="space-y-2">
              <Label className="text-xs">Public link</Label>
              <div className="flex gap-2">
                <Input value={url} readOnly className="font-mono text-xs" />
                <Button onClick={handleCopy} variant="outline" size="icon" className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
