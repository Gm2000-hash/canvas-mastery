// Per-page toggle to reveal real student names. Each reveal is audited
// server-side and includes an optional reason (e.g. "Parent meeting").
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  revealed: boolean;
  loading?: boolean;
  onReveal: (reason?: string) => Promise<boolean> | void;
  onHide: () => void;
  disabled?: boolean;
};

export function RevealNamesToggle({ revealed, loading, onReveal, onHide, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (revealed) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        onClick={onHide}
        disabled={disabled}
        title="Hide real names"
      >
        <EyeOff className="h-4 w-4 mr-1.5" /> Hide real names
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setOpen(true)}
        disabled={disabled || loading}
        title="Show real names (logged)"
      >
        {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Eye className="h-4 w-4 mr-1.5" />}
        Show real names
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reveal real student names?</DialogTitle>
            <DialogDescription>
              Real names will be shown only on this page until you hide them again.
              Each reveal is recorded in your privacy log along with an optional reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reveal-reason">Reason (optional)</Label>
            <Input
              id="reveal-reason"
              value={reason}
              placeholder="e.g. Parent meeting, IEP review"
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const ok = await onReveal(reason.trim() || undefined);
                if (ok !== false) {
                  setOpen(false);
                  setReason("");
                }
              }}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Reveal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
